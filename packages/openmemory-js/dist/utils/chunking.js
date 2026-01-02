"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.join_chunks = exports.agg_vec = exports.chunk_text = void 0;
const cpt = 4;
const est = (t) => Math.ceil(t.length / cpt);
const chunk_text = (txt, tgt = 768, ovr = 0.1) => {
    const tot = est(txt);
    if (tot <= tgt)
        return [{ text: txt, start: 0, end: txt.length, tokens: tot }];
    const tch = tgt * cpt, och = Math.floor(tch * ovr);
    const paras = txt.split(/\n\n+/);
    const chks = [];
    let cur = "", cs = 0;
    for (const p of paras) {
        const sents = p.split(/(?<=[.!?])\s+/);
        for (const s of sents) {
            const pot = cur + (cur ? " " : "") + s;
            if (pot.length > tch && cur.length > 0) {
                chks.push({
                    text: cur,
                    start: cs,
                    end: cs + cur.length,
                    tokens: est(cur),
                });
                const ovt = cur.slice(-och);
                cur = ovt + " " + s;
                cs = cs + cur.length - ovt.length - 1;
            }
            else
                cur = pot;
        }
    }
    if (cur.length > 0)
        chks.push({
            text: cur,
            start: cs,
            end: cs + cur.length,
            tokens: est(cur),
        });
    return chks;
};
exports.chunk_text = chunk_text;
const agg_vec = (vecs) => {
    const n = vecs.length;
    if (!n)
        throw new Error("no vecs");
    if (n === 1)
        return vecs[0].slice();
    const d = vecs[0].length, r = new Array(d).fill(0);
    for (const v of vecs)
        for (let i = 0; i < d; i++)
            r[i] += v[i];
    const rc = 1 / n;
    for (let i = 0; i < d; i++)
        r[i] *= rc;
    return r;
};
exports.agg_vec = agg_vec;
const join_chunks = (cks) => cks.length ? cks.map((c) => c.text).join(" ") : "";
exports.join_chunks = join_chunks;
