"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buf_to_vec = exports.vec_to_buf = exports.p = exports.j = exports.cos_sim = exports.rid = exports.now = void 0;
const now = () => Date.now();
exports.now = now;
const rid = () => crypto.randomUUID();
exports.rid = rid;
const cos_sim = (a, b) => {
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) {
        const x = a[i], y = b[i];
        dot += x * y;
        na += x * x;
        nb += y * y;
    }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d ? dot / d : 0;
};
exports.cos_sim = cos_sim;
exports.j = JSON.stringify;
const p = (x) => JSON.parse(x);
exports.p = p;
const vec_to_buf = (v) => {
    const f32 = new Float32Array(v);
    return Buffer.from(f32.buffer);
};
exports.vec_to_buf = vec_to_buf;
const buf_to_vec = (buf) => {
    return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
};
exports.buf_to_vec = buf_to_vec;
