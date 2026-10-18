/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : tools/check-recall.ts
 *  usage : fast end-to-end smoke test of ingest + all four recall modes
 */

import assert from 'node:assert/strict';
import { createMemory } from '../src/index.js';

async function main() {
    const memory = createMemory({ store: 'memory', embedding_dimension: 2 });

    const status = memory.status();
    assert.equal(status.ready, true, 'engine should report ready immediately after construction');

    const first = await memory.ingest({ user_id: 'check-recall', text: 'The release checklist lives in tools/.', world: 'release-check', vector: [1, 0] });
    assert.ok(first.node.id, 'ingest should return a node id');

    const strict = await memory.recall({ text: 'Where does the release checklist live?', mode: 'strict', vector: [1, 0], k: 3 });
    assert.ok('items' in strict && strict.items.some((item) => item.node.id === first.node.id), 'strict recall should surface the ingested node');

    const superseding = await memory.ingest({ user_id: 'check-recall', text: 'The release checklist now lives in docs/.', world: 'release-check', vector: [1, 0], at: Date.now() + 1 });
    assert.ok(superseding.node.id !== first.node.id, 'a superseding observation should create a new node, not mutate the old one');

    const historical = await memory.getTimeline({});
    assert.ok(historical.timeline.entries.some((entry) => entry.node.id === first.node.id), 'historical recall should still return the superseded node');

    const associative = await memory.recall({ text: 'release checklist', mode: 'associative', vector: [1, 0], k: 5 });
    assert.ok('items' in associative && associative.items.length > 0, 'associative recall should return at least one candidate');

    const worlds = await memory.listWorlds();
    assert.ok(worlds.some((world) => world.id === 'release-check' || world.name === 'release-check'), 'the ingested world should be listed');

    await memory.close();
    const preferences = createMemory({ store: 'memory', embedding_dimension: 2 });
    try {
        const at = Date.now() - 1000;
        await preferences.ingest({ user_id: 'profile-check', text: 'I lead the payments team. I prefer dark mode for the editor.', world: 'profile-check', vector: [1, 0], at });
        await preferences.ingest({ user_id: 'profile-check', text: 'Actually, switch me to light mode.', world: 'profile-check', vector: [1, 0], at: at + 1 });
        const current = await preferences.recall({ text: 'Which editor mode do I prefer now?', mode: 'associative', vector: [1, 0], k: 5 });
        assert.ok('context' in current && current.context.evidence[0].text.includes('light mode'), 'current mode query should prefer the relevant replacement');
        assert.ok('context' in current && current.context.evidence.some((item) => item.text.includes('superseded')), 'associative recall should retain labeled history');
        const team = await preferences.recall({ text: 'Which team do I lead now?', mode: 'associative', vector: [1, 0], k: 1 });
        assert.ok('context' in team && team.context.evidence[0].text.includes('payments'), 'an unrelated replacement must not hide a still-relevant claim');
        const earlier = await preferences.recall({ text: 'Which mode did I prefer before?', mode: 'associative', vector: [1, 0], k: 5 });
        assert.ok('context' in earlier && earlier.context.evidence.some((item) => item.text.includes('dark mode')), 'historical questions should retain old preferences');
        await preferences.ingest({ user_id: 'profile-check', text: 'I now prefer high contrast mode.', world: 'profile-check', vector: [1, 0], at: at + 2 });
        const latest = await preferences.recall({ text: 'Which mode do I prefer now?', mode: 'associative', vector: [1, 0], k: 1 });
        assert.ok('context' in latest && latest.context.evidence[0].text.includes('high contrast'), 'current questions should follow transitive supersession chains');
    } finally { await preferences.close(); }
    console.log('recall:check: ingest, strict, historical, and associative recall all behaved as expected.');
}

main().catch((error) => {
    console.error('recall:check failed:', error);
    process.exit(1);
});
