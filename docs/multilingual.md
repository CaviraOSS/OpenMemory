<!--
     __                      __  ___
    / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
   / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
  / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
 /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/

 cavira oss (c) 2026  -  nullure (c) 2026
 ==========================================================
 file  : docs/multilingual.md
 usage : documents LongMemory multilingual
-->

# Multilingual memory

LongMemory Hydrograph stores and recalls memory across human languages without making English the hidden source of truth.

The original wording and script remain authoritative. Normalization, transliteration, translation, and embeddings are derived search/presentation aids. They cannot bypass temporal validity, grounding, contradiction, permission, or memory-contract gates.

## Original text preservation

Every newly ingested HydroNode records:

- `language`
- `script`
- `direction`
- `original_text`
- `canonical_text`
- Optional `translated_text`
- Optional `transliteration`
- `locale`
- `code_switch_segments`
- `language_confidence`
- Optional translation provenance

`content.raw` and `content.original_text` preserve the exact submitted string, including its original script and wording. `raw` remains part of the content hash.

Canonical text is a search view. It applies NFC Unicode normalization, removes BOM and zero-width space, normalizes whitespace and compatible punctuation, and performs locale-aware lowercasing. It preserves Indic marks, Arabic shaping characters, CJK characters, ZWJ, and ZWNJ.

Latin diacritic folding is available as a secondary search variant. It is not applied destructively to the source text or non-Latin scripts.

```ts
const memory = await createMemory();

const result = await memory.ingest({
  user_id: "user:alice",
  text: "मुझे TypeScript पसंद है backend के लिए.",
});

console.log(result.node.content.original_text);
console.log(result.node.content.language); // mixed
console.log(result.node.content.code_switch_segments);
```

## Language and script detection

```ts
import { detectLanguage, detectScript, detectCodeSwitching } from "longmemory";
```

Supported language goals include English, Hindi, Telugu, Tamil, Bengali, Urdu, Arabic, Spanish, French, German, Dutch, Finnish, Chinese, Japanese, Korean, Russian, Portuguese, and mixed text.

Detection uses Unicode script evidence and language-specific lexical signals. Script detection reports all observed scripts, their ratios, dominant/mixed script, confidence, and writing direction.

Code-switch detection records original offsets and segments. A Hindi/English message therefore retains separate Devanagari and Latin spans instead of being flattened into one language.

## Normalization and transliteration

```ts
import { normalizeMultilingualText, transliterate } from "longmemory";
```

Transliteration is optional and conservative. It currently provides curated Indic aliases and deterministic Arabic/Urdu and Cyrillic search forms. Unsupported scripts return no transliteration rather than fabricating a low-quality alias.

Transliterations are never source truth. They are search/entity hints with scheme and confidence.

## Language-aware tokenization

```ts
import { tokenize } from "longmemory";

tokenize("用户喜欢数据库", "zh", "Han");
```

The tokenizer handles:

- Whitespace languages and combining marks
- Hindi, Telugu, Tamil, Bengali, and other Indic scripts
- Arabic/Urdu script
- Individual Han, Hiragana, Katakana, and Hangul units without assuming spaces
- Latin runs inside CJK or Indic text
- Mixed-language messages

Core context budgeting uses the stricter maximum of language-aware tokens and the established subword estimate. Multilingual context can therefore fit correctly without weakening existing budget behavior.

## Multilingual embeddings

`multilingual_embedding_provider` accepts any provider that embeds text into a shared cross-language vector space.

When no provider is supplied, LongMemory uses a small deterministic fallback with eight dimensions and shared concepts for common preference/project queries. The fallback is intended for predictable local behavior and tests, not as a replacement for a production multilingual embedding model.

```ts
const memory = await createMemory({
  multilingual_embedding_provider: {
    embed: async (text, language) => model.embed(text, language),
  },
});
```

Embeddings influence ranking only. Admission gates run first, so similarity cannot resurrect stale, contradicted, unauthorized, ungrounded, or contract-forbidden memory.

## Cross-lingual recall

A query language does not need to match the stored language:

```ts
await memory.ingest({
  user_id: "user:alice",
  text: "मुझे TypeScript पसंद है backend के लिए.",
});

const result = await memory.recall({
  text: "What language does the user prefer for backend?",
  mode: "strict",
});
```

Cross-lingual recall combines:

1. Query language/script detection
2. Language-aware lexical matching in original/canonical text
3. Transliteration search forms
4. Explicit multilingual entity aliases
5. Shared multilingual embeddings
6. Existing temporal, contract, contradiction, grounding, permission, and confidence gates

Translation is not used as strict lexical truth. A bad or low-confidence English translation cannot make an unrelated original-language memory pass a truth gate.

## Multilingual output packets

Use `recallMultilingual` when an agent needs explicit original/display language policy:

```ts
const result = await memory.recallMultilingual({
  text: "backend preference",
  mode: "strict",
  output_language: "en",
  token_budget: 256,
});
```

Each context item includes:

- `original_text`
- `display_text`
- Original language
- Output language
- `translation_used`
- Translation confidence and provenance
- HydroNode and source provenance

The original quote is always available even when translated display text is used.

## Translation is derived

Translation is disabled by default.

```ts
const memory = await createMemory({
  enable_translation: true,
  output_language: "en",
  translation_provider: {
    name: "my-translator",
    translate: async (text, from, to) => ({
      text: await translator.translate(text, from, to),
      confidence: 0.94,
      provider: "my-translator",
    }),
  },
});
```

Stored translations carry provider, target language, confidence, derivation time, and source-text hash. They do not replace `raw`, `original_text`, or canonical source identity.

By default, multilingual output uses translated display text only at confidence `0.7` or higher. Lower-confidence results remain original-language display and report the low confidence.

## Exact-language contracts

Memory contracts add:

- `preserve_exact_language`
- `translation_allowed`
- `transliteration_allowed`

```ts
await memory.ingest({
  user_id: "legal",
  text: "契約条項を変更しないこと。",
  contract: {
    preserve_exact_language: true,
    translation_allowed: false,
    transliteration_allowed: false,
  },
});
```

Exact-language memories are never replaced by a translated display in `recallMultilingual`. The source quote remains mandatory.

## Multilingual entity resolution

The entity resolver now normalizes names with Unicode letters and marks rather than ASCII-only filtering.

```ts
const canonical = await memory.resolveEntity({
  name: "Narendra Modi",
  type: "person",
  aliases: ["Modi"],
});

const telugu = await memory.resolveEntity({
  name: "మోదీ",
  type: "person",
});
```

Explicit aliases may resolve across scripts through conservative transliteration. Transliteration alone does not merge two canonical names. A transliterated canonical-name match requires explicit alias evidence, context overlap, or `allow_transliteration_match: true`. Existing type/domain/disambiguator conflict guards still run.

This prevents two people from merging merely because different names collapse to the same Latin spelling.

## Locale and direction

Locale context includes language, script, region, direction, and a reserved cultural-context map. Arabic/Urdu memory records `rtl`; mixed Arabic/Latin text records `mixed` direction.

Direction metadata is presentation context only. Source order and original Unicode are not rewritten.

## Configuration

```ts
const memory = await createMemory({
  default_language: "en",
  output_language: "en",
  preserve_original_text: true,
  enable_translation: false,
  translation_provider,
  enable_transliteration: true,
  multilingual_embedding_provider,
  fallback_language: "en",
});
```

Original text is retained even when `preserve_original_text` is omitted. This option declares output policy; it does not permit destructive loss of source wording.

## Benchmarks

The reusable benchmark harness includes the `multilingual` suite and eight gates:

1. Language detection accuracy
2. Script detection accuracy
3. Code-switch detection
4. Cross-lingual recall accuracy
5. Entity alias matching across scripts
6. Translation safety
7. No loss of original text
8. Multilingual token-budget compliance

Datasets live under `src/benchmarks/datasets`:

- `multilingual_preferences.ts`
- `multilingual_entities.ts`
- `code_switching.ts`
- `crosslingual_recall.ts`
- `translation_safety.ts`

```bash
pnpm exec tsx benchmarks/src/cli.ts --quick --only=multilingual --ci
```
