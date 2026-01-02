"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ingestDocument = ingestDocument;
exports.ingestURL = ingestURL;
const hsg_1 = require("../memory/hsg");
const db_1 = require("../core/db");
const utils_1 = require("../utils");
const extract_1 = require("./extract");
const LG = 8000, SEC = 3000;
const split = (t, sz) => {
    if (t.length <= sz)
        return [t];
    const secs = [];
    const paras = t.split(/\n\n+/);
    let cur = "";
    for (const p of paras) {
        if (cur.length + p.length > sz && cur.length > 0) {
            secs.push(cur.trim());
            cur = p;
        }
        else
            cur += (cur ? "\n\n" : "") + p;
    }
    if (cur.trim())
        secs.push(cur.trim());
    return secs;
};
const mkRoot = async (txt, ex, meta, user_id) => {
    const sum = txt.length > 500 ? txt.slice(0, 500) + "..." : txt;
    const cnt = `[Document: ${ex.metadata.content_type.toUpperCase()}]\n\n${sum}\n\n[Full content split across ${Math.ceil(txt.length / SEC)} sections]`;
    const id = (0, utils_1.rid)(), ts = (0, utils_1.now)();
    await db_1.transaction.begin();
    try {
        await db_1.q.ins_mem.run(id, cnt, "reflective", (0, utils_1.j)([]), (0, utils_1.j)({
            ...meta,
            ...ex.metadata,
            is_root: true,
            ingestion_strategy: "root-child",
            ingested_at: ts,
        }), ts, ts, ts, 1.0, 0.1, 1, user_id || "anonymous", null);
        await db_1.transaction.commit();
        return id;
    }
    catch (e) {
        console.error("[ERROR] Root failed:", e);
        await db_1.transaction.rollback();
        throw e;
    }
};
const mkChild = async (txt, idx, tot, rid, meta, user_id) => {
    const r = await (0, hsg_1.add_hsg_memory)(txt, (0, utils_1.j)([]), {
        ...meta,
        is_child: true,
        section_index: idx,
        total_sections: tot,
        parent_id: rid,
    }, user_id || undefined);
    return r.id;
};
const link = async (rid, cid, idx, user_id) => {
    const ts = (0, utils_1.now)();
    await db_1.transaction.begin();
    try {
        await db_1.q.ins_waypoint.run(rid, cid, user_id || "anonymous", 1.0, ts, ts);
        await db_1.transaction.commit();
        console.log(`[INGEST] Linked: ${rid.slice(0, 8)} -> ${cid.slice(0, 8)} (section ${idx})`);
    }
    catch (e) {
        await db_1.transaction.rollback();
        console.error(`[INGEST] Link failed for section ${idx}:`, e);
        throw e;
    }
};
async function ingestDocument(t, data, meta, cfg, user_id) {
    const th = cfg?.lg_thresh || LG, sz = cfg?.sec_sz || SEC;
    const ex = await (0, extract_1.extractText)(t, data);
    const { text, metadata: exMeta } = ex;
    const useRC = cfg?.force_root || exMeta.estimated_tokens > th;
    if (!useRC) {
        const r = await (0, hsg_1.add_hsg_memory)(text, (0, utils_1.j)([]), {
            ...meta,
            ...exMeta,
            ingestion_strategy: "single",
            ingested_at: (0, utils_1.now)(),
        }, user_id || undefined);
        return {
            root_memory_id: r.id,
            child_count: 0,
            total_tokens: exMeta.estimated_tokens,
            strategy: "single",
            extraction: exMeta,
        };
    }
    const secs = split(text, sz);
    console.log(`[INGEST] Document: ${exMeta.estimated_tokens} tokens`);
    console.log(`[INGEST] Splitting into ${secs.length} sections`);
    let rid;
    const cids = [];
    try {
        rid = await mkRoot(text, ex, meta, user_id);
        console.log(`[INGEST] Root memory created: ${rid}`);
        for (let i = 0; i < secs.length; i++) {
            try {
                const cid = await mkChild(secs[i], i, secs.length, rid, meta, user_id);
                cids.push(cid);
                await link(rid, cid, i, user_id);
                console.log(`[INGEST] Section ${i + 1}/${secs.length} processed: ${cid}`);
            }
            catch (e) {
                console.error(`[INGEST] Section ${i + 1}/${secs.length} failed:`, e);
                throw e;
            }
        }
        console.log(`[INGEST] Completed: ${cids.length} sections linked to ${rid}`);
        return {
            root_memory_id: rid,
            child_count: secs.length,
            total_tokens: exMeta.estimated_tokens,
            strategy: "root-child",
            extraction: exMeta,
        };
    }
    catch (e) {
        console.error("[INGEST] Document ingestion failed:", e);
        throw e;
    }
}
async function ingestURL(url, meta, cfg, user_id) {
    const { extractURL } = await Promise.resolve().then(() => __importStar(require("./extract")));
    const ex = await extractURL(url);
    const th = cfg?.lg_thresh || LG, sz = cfg?.sec_sz || SEC;
    const useRC = cfg?.force_root || ex.metadata.estimated_tokens > th;
    if (!useRC) {
        const r = await (0, hsg_1.add_hsg_memory)(ex.text, (0, utils_1.j)([]), {
            ...meta,
            ...ex.metadata,
            ingestion_strategy: "single",
            ingested_at: (0, utils_1.now)(),
        }, user_id || undefined);
        return {
            root_memory_id: r.id,
            child_count: 0,
            total_tokens: ex.metadata.estimated_tokens,
            strategy: "single",
            extraction: ex.metadata,
        };
    }
    const secs = split(ex.text, sz);
    console.log(`[INGEST] URL: ${ex.metadata.estimated_tokens} tokens`);
    console.log(`[INGEST] Splitting into ${secs.length} sections`);
    let rid;
    const cids = [];
    try {
        rid = await mkRoot(ex.text, ex, { ...meta, source_url: url }, user_id);
        console.log(`[INGEST] Root memory for URL: ${rid}`);
        for (let i = 0; i < secs.length; i++) {
            try {
                const cid = await mkChild(secs[i], i, secs.length, rid, { ...meta, source_url: url }, user_id);
                cids.push(cid);
                await link(rid, cid, i, user_id);
                console.log(`[INGEST] URL section ${i + 1}/${secs.length} processed: ${cid}`);
            }
            catch (e) {
                console.error(`[INGEST] URL section ${i + 1}/${secs.length} failed:`, e);
                throw e;
            }
        }
        console.log(`[INGEST] URL completed: ${cids.length} sections linked to ${rid}`);
        return {
            root_memory_id: rid,
            child_count: secs.length,
            total_tokens: ex.metadata.estimated_tokens,
            strategy: "root-child",
            extraction: ex.metadata,
        };
    }
    catch (e) {
        console.error("[INGEST] URL ingestion failed:", e);
        throw e;
    }
}
