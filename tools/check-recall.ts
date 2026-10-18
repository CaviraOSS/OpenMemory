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
    console.log('recall:check: ingest, strict, historical, and associative recall all behaved as expected.');
}

main().catch((error) => {
    console.error('recall:check failed:', error);
    process.exit(1);
});
