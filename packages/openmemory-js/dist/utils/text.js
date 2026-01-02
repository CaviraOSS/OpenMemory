"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.add_synonym_tokens = exports.canonical_token_set = exports.build_fts_query = exports.build_search_doc = exports.synonyms_for = exports.canonical_tokens_from_text = exports.canonicalize_token = exports.tokenize = void 0;
const syn_grps = [
    ["prefer", "like", "love", "enjoy", "favor"],
    ["theme", "mode", "style", "layout"],
    ["meeting", "meet", "session", "call", "sync"],
    ["dark", "night", "black"],
    ["light", "bright", "day"],
    ["user", "person", "people", "customer"],
    ["task", "todo", "job"],
    ["note", "memo", "reminder"],
    ["time", "schedule", "when", "date"],
    ["project", "initiative", "plan"],
    ["issue", "problem", "bug"],
    ["document", "doc", "file"],
    ["question", "query", "ask"],
];
const cmap = new Map();
const slook = new Map();
for (const grp of syn_grps) {
    const can = grp[0];
    const sset = new Set(grp);
    for (const w of grp) {
        cmap.set(w, can);
        slook.set(can, sset);
    }
}
const stem_rules = [
    [/ies$/, "y"],
    [/ing$/, ""],
    [/ers?$/, "er"],
    [/ed$/, ""],
    [/s$/, ""],
];
const tok_pat = /[a-z0-9]+/gi;
const tokenize = (text) => {
    const toks = [];
    let m;
    while ((m = tok_pat.exec(text))) {
        toks.push(m[0].toLowerCase());
    }
    return toks;
};
exports.tokenize = tokenize;
const stem = (tok) => {
    if (tok.length <= 3)
        return tok;
    for (const [pat, rep] of stem_rules) {
        if (pat.test(tok)) {
            const st = tok.replace(pat, rep);
            if (st.length >= 3)
                return st;
        }
    }
    return tok;
};
const canonicalize_token = (tok) => {
    if (!tok)
        return "";
    const low = tok.toLowerCase();
    if (cmap.has(low))
        return cmap.get(low);
    const st = stem(low);
    return cmap.get(st) || st;
};
exports.canonicalize_token = canonicalize_token;
const canonical_tokens_from_text = (text) => {
    const res = [];
    for (const tok of (0, exports.tokenize)(text)) {
        const can = (0, exports.canonicalize_token)(tok);
        if (can && can.length > 1) {
            res.push(can);
        }
    }
    return res;
};
exports.canonical_tokens_from_text = canonical_tokens_from_text;
const synonyms_for = (tok) => {
    const can = (0, exports.canonicalize_token)(tok);
    return slook.get(can) || new Set([can]);
};
exports.synonyms_for = synonyms_for;
const build_search_doc = (text) => {
    const can = (0, exports.canonical_tokens_from_text)(text);
    const exp = new Set();
    for (const tok of can) {
        exp.add(tok);
        const syns = slook.get(tok);
        if (syns) {
            syns.forEach((s) => exp.add(s));
        }
    }
    return Array.from(exp).join(" ");
};
exports.build_search_doc = build_search_doc;
const build_fts_query = (text) => {
    const can = (0, exports.canonical_tokens_from_text)(text);
    if (!can.length)
        return "";
    const uniq = Array.from(new Set(can.filter((t) => t.length > 1)));
    return uniq.map((t) => `"${t}"`).join(" OR ");
};
exports.build_fts_query = build_fts_query;
const canonical_token_set = (text) => {
    return new Set((0, exports.canonical_tokens_from_text)(text));
};
exports.canonical_token_set = canonical_token_set;
const add_synonym_tokens = (toks) => {
    const res = new Set();
    for (const tok of toks) {
        res.add(tok);
        const syns = slook.get(tok);
        if (syns) {
            syns.forEach((s) => res.add((0, exports.canonicalize_token)(s)));
        }
    }
    return res;
};
exports.add_synonym_tokens = add_synonym_tokens;
