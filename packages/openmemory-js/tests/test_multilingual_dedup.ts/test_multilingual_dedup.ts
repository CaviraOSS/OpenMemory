import assert from "node:assert/strict";
import { canonical_tokens_from_text, tokenize } from "../src/utils/text";
import { compute_simhash } from "../src/memory/hsg";

const left = "我喜欢健身";
const right = "我喜欢普洱茶";

assert.deepEqual(tokenize(right), ["我喜", "喜欢", "欢普", "普洱", "洱茶"]);

const leftTokens = canonical_tokens_from_text(left);
const rightTokens = canonical_tokens_from_text(right);

assert.ok(leftTokens.length > 0);
assert.ok(rightTokens.length > 0);
assert.notDeepEqual(new Set(leftTokens), new Set(rightTokens));
assert.notEqual(compute_simhash(left), compute_simhash(right));
assert.notEqual(compute_simhash("!!!"), compute_simhash("???"));
assert.equal(compute_simhash("!!!"), compute_simhash("!!!"));

console.log("test_multilingual_dedup.ts passed");
