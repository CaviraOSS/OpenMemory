import { describe, expect, it } from 'vitest';
import {
    code_switching,
    crosslingual_recall_dataset,
    multilingual_entities,
    multilingual_preferences,
    translation_safety,
} from './fixtures/multilingual.js';
import {
    createMemory as create_memory,
    detectCodeSwitching,
    detectLanguage,
    detectScript,
    normalizeMultilingualText,
    tokenize,
    transliterate,
    type translation_provider,
} from '../src/index.js';

const high_translation: translation_provider = {
    name: 'fixture-translator',
    async translate(text, from, to) {
        const translations: Record<string, string> = {
            'मुझे चाय पसंद है': 'I like tea',
            'मुझे TypeScript पसंद है backend के लिए.': 'I prefer TypeScript for backend.',
        };
        return { text: translations[text] ?? `[${to}] ${text}`, confidence: 0.95, provider: 'fixture-translator' };
    },
};

describe('phase 26 multilingual and cross-lingual memory', () => {
    it('1. recalls Hindi/code-switched memory from an English query', async () => {
        const memory = await create_memory();
        const stored = await memory.ingest({ user_id: 'u1', text: 'मुझे TypeScript पसंद है backend के लिए.' });
        const result = await memory.recall({ text: 'What language does the user prefer for backend?', mode: 'strict' });
        expect('items' in result && result.items.map((item) => item.node.id)).toContain(stored.node.id);
        expect(stored.node.content.language).toBe('mixed');
        await memory.close();
    });

    it('2. recalls English memory from a Hindi query', async () => {
        const memory = await create_memory();
        const stored = await memory.ingest({ user_id: 'u1', text: 'I prefer TypeScript for backend development.' });
        const result = await memory.recall({ text: 'बैकएंड के लिए उपयोगकर्ता कौन सी भाषा पसंद करता है?', mode: 'strict' });
        expect('items' in result && result.items.map((item) => item.node.id)).toContain(stored.node.id);
        await memory.close();
    });

    it('3. resolves a Telugu entity alias conservatively', async () => {
        const memory = await create_memory();
        const canonical = await memory.resolveEntity({ name: 'Narendra Modi', type: 'person', aliases: ['Modi'], observed_at: 1 });
        const telugu = await memory.resolveEntity({ name: 'మోదీ', type: 'person', observed_at: 2 });
        expect(telugu.action).toBe('resolved');
        expect(telugu.entity.id).toBe(canonical.entity.id);
        expect(telugu.entity.aliases).toContain('మోదీ');
        await memory.close();
    });

    it('4. stores code-switched language and script segments', async () => {
        const memory = await create_memory();
        const result = await memory.ingest({ user_id: 'u1', text: 'మనం TypeScript తో backend build చేద్దాం.' });
        const segments = result.node.content.code_switch_segments ?? [];
        expect(result.node.content.language).toBe('mixed');
        expect(new Set(segments.map((segment) => segment.script))).toEqual(new Set(['Telugu', 'Latin']));
        expect(segments.some((segment) => segment.language === 'te')).toBe(true);
        expect(segments.some((segment) => segment.language === 'en')).toBe(true);
        await memory.close();
    });

    it('5. preserves original text exactly while deriving canonical search text', async () => {
        const original = '  मुझे\u200B  चाय पसंद है।\n';
        const memory = await create_memory();
        const result = await memory.ingest({ user_id: 'u1', text: original });
        expect(result.node.content.raw).toBe(original);
        expect(result.node.content.original_text).toBe(original);
        expect(result.node.content.canonical_text).toBe('मुझे चाय पसंद है।');
        expect(normalizeMultilingualText(original, 'hi').original_text).toBe(original);
        await memory.close();
    });

    it('6. marks translation as a derived view with provenance', async () => {
        const memory = await create_memory({ enable_translation: true, output_language: 'en', translation_provider: high_translation });
        const result = await memory.ingest({ user_id: 'u1', text: 'मुझे चाय पसंद है' });
        expect(result.node.content.raw).toBe('मुझे चाय पसंद है');
        expect(result.node.content.translated_text).toBe('I like tea');
        expect(result.node.content.translation_provenance).toMatchObject({ provider: 'fixture-translator', target_language: 'en', confidence: 0.95 });
        expect(result.node.content.translation_provenance?.source_text_hash).toMatch(/^[0-9a-f]{64}$/);
        await memory.close();
    });

    it('7. strict recall does not use low-confidence translation as lexical truth', async () => {
        const low_translation: translation_provider = { name: 'unsafe-translator', translate: async () => ({ text: 'bananas are preferred', confidence: 0.2 }) };
        const memory = await create_memory({ enable_translation: true, output_language: 'en', translation_provider: low_translation });
        await memory.ingest({ user_id: 'u1', text: 'मुझे चाय पसंद है' });
        const result = await memory.recall({ text: 'bananas', mode: 'strict' });
        expect('items' in result && result.items[0].breakdown.lexical_score).toBe(0);
        const cross = await memory.recallMultilingual({ text: 'bananas', mode: 'strict', output_language: 'en', translation_confidence_threshold: 0.7 });
        expect(cross.items[0]).toMatchObject({ translation_used: false, display_text: 'मुझे चाय पसंद है', translation_confidence: 0.2 });
        await memory.close();
    });

    it('8. does not merge people only because transliterations collide', async () => {
        const memory = await create_memory();
        const first = await memory.resolveEntity({ name: 'سمر خان', type: 'person', observed_at: 1, metadata: { domain: 'research', disambiguator: 'researcher' } });
        const second = await memory.resolveEntity({ name: 'ثمر خان', type: 'person', observed_at: 2, metadata: { domain: 'music', disambiguator: 'musician' } });
        expect(transliterate('سمر خان', 'ur')?.text).toBe(transliterate('ثمر خان', 'ur')?.text);
        expect(second.entity.id).not.toBe(first.entity.id);
        expect(second.action).not.toBe('resolved');
        await memory.close();
    });

    it('9. tokenizes CJK without whitespace assumptions', () => {
        const chinese = tokenize('用户喜欢数据库', 'zh', 'Han');
        const japanese = tokenize('ユーザーはTypeScriptが好きです', 'ja', 'Mixed');
        expect(chinese.length).toBeGreaterThanOrEqual(7);
        expect(chinese.map((token) => token.value).join('')).toContain('数据库');
        expect(japanese.length).toBeGreaterThan(3);
    });

    it('10. preserves Arabic and Urdu script direction metadata', async () => {
        const memory = await create_memory();
        const arabic = await memory.ingest({ user_id: 'u1', text: 'المشروع يستخدم PostgreSQL' });
        const urdu = await memory.ingest({ user_id: 'u1', text: 'مجھے TypeScript پسند ہے' });
        expect(arabic.node.content).toMatchObject({ script: 'Mixed', direction: 'mixed' });
        expect(urdu.node.content).toMatchObject({ language: 'mixed', script: 'Mixed', direction: 'mixed' });
        expect(detectScript('یہ منصوبہ اردو میں ہے').direction).toBe('rtl');
        await memory.close();
    });

    it('11. keeps multilingual recall within context budget', async () => {
        const memory = await create_memory();
        for (const item of multilingual_preferences) await memory.ingest({ user_id: 'u1', text: item.text });
        const result = await memory.recallMultilingual({ text: 'What does the user prefer?', mode: 'associative', token_budget: 12 });
        expect(result.context.tokens_used).toBeLessThanOrEqual(12);
        expect(result.context.within_budget).toBe(true);
        await memory.close();
    });

    it('12. returns original language and translated display text together', async () => {
        const memory = await create_memory({ enable_translation: true, output_language: 'en', translation_provider: high_translation });
        await memory.ingest({ user_id: 'u1', text: 'मुझे TypeScript पसंद है backend के लिए.' });
        const result = await memory.recallMultilingual({ text: 'backend preference', mode: 'strict', output_language: 'en', token_budget: 50 });
        expect(result.items[0]).toMatchObject({
            original_text: 'मुझे TypeScript पसंद है backend के लिए.',
            display_text: 'I prefer TypeScript for backend.',
            language: 'mixed',
            output_language: 'en',
            translation_used: true,
            translation_confidence: 0.95,
        });
        expect(result.items[0].provenance.source_trace.length).toBeGreaterThan(0);
        await memory.close();
    });
});

describe('multilingual benchmark categories', () => {
    it('covers language/script detection, code switching, recall, entities, translation safety, originals, and budgets', () => {
        expect(multilingual_preferences.length).toBeGreaterThanOrEqual(4);
        expect(multilingual_entities.some((item) => item.should_merge)).toBe(true);
        expect(code_switching).toHaveLength(3);
        expect(crosslingual_recall_dataset).toHaveLength(3);
        expect(translation_safety.some((item) => item.translation_allowed === false)).toBe(true);
        expect(detectLanguage('यह एक हिंदी वाक्य है').language).toBe('hi');
        expect(detectLanguage('Este proyecto usa SQLite').language).toBe('es');
        expect(detectScript('తెలుగు').script).toBe('Telugu');
        expect(detectCodeSwitching('मुझे TypeScript पसंद है').length).toBeGreaterThan(1);
    });
});