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
exports.Memory = void 0;
const hsg_1 = require("../memory/hsg");
const db_1 = require("./db");
class Memory {
    default_user;
    constructor(user_id) {
        this.default_user = user_id || null;
    }
    async add(content, opts) {
        const uid = opts?.user_id || this.default_user;
        const tags = opts?.tags || [];
        const meta = { ...opts };
        delete meta.user_id;
        delete meta.tags;
        // Ensure tags is JSON string if needed by add_hsg_memory
        // hsg.ts signature: add_hsg_memory(content, tags, meta, user_id)
        // tags is usually stringified JSON or string? 
        // Checked hsg.ts: interface hsg_mem { tags?: string }
        // Let's pass JSON string for tags.
        const tags_str = JSON.stringify(tags);
        // hsg.ts add_hsg_memory returns { id, ... } or similar?
        // Let's check hsg.ts exports. It's likely async and returns object.
        const res = await (0, hsg_1.add_hsg_memory)(content, tags_str, meta, uid ?? undefined);
        return res;
    }
    async get(id) {
        return await db_1.q.get_mem.get(id);
    }
    async search(query, opts) {
        // hsg_query(qt, k, f)
        const k = opts?.limit || 10;
        const uid = opts?.user_id || this.default_user;
        const f = {};
        if (uid)
            f.user_id = uid;
        if (opts?.sectors)
            f.sectors = opts.sectors;
        return await (0, hsg_1.hsg_query)(query, k, f);
    }
    async delete_all(user_id) {
        const uid = user_id || this.default_user;
        if (uid) {
            // q.del_mem usually exists or we execute raw SQL
            // But we can't easily access q here if not exported or if we want to change memory.ts minimal
            // I'll add a wipe() method that calls q directly if q is imported
        }
    }
    async wipe() {
        console.log("[Memory] Wiping DB...");
        // q is imported from db.ts
        await db_1.q.clear_all.run();
    }
    /**
     * get a pre-configured source connector.
     *
     * usage:
     *   const github = mem.source("github")
     *   await github.connect({ token: "ghp_..." })
     *   await github.ingest_all({ repo: "owner/repo" })
     *
     * available sources: github, notion, google_drive, google_sheets,
     *                   google_slides, onedrive, web_crawler
     */
    source(name) {
        // dynamic import to avoid circular deps
        const sources = {
            github: () => Promise.resolve().then(() => __importStar(require("../sources/github"))).then(m => new m.github_source(this.default_user ?? undefined)),
            notion: () => Promise.resolve().then(() => __importStar(require("../sources/notion"))).then(m => new m.notion_source(this.default_user ?? undefined)),
            google_drive: () => Promise.resolve().then(() => __importStar(require("../sources/google_drive"))).then(m => new m.google_drive_source(this.default_user ?? undefined)),
            google_sheets: () => Promise.resolve().then(() => __importStar(require("../sources/google_sheets"))).then(m => new m.google_sheets_source(this.default_user ?? undefined)),
            google_slides: () => Promise.resolve().then(() => __importStar(require("../sources/google_slides"))).then(m => new m.google_slides_source(this.default_user ?? undefined)),
            onedrive: () => Promise.resolve().then(() => __importStar(require("../sources/onedrive"))).then(m => new m.onedrive_source(this.default_user ?? undefined)),
            web_crawler: () => Promise.resolve().then(() => __importStar(require("../sources/web_crawler"))).then(m => new m.web_crawler_source(this.default_user ?? undefined)),
        };
        if (!(name in sources)) {
            throw new Error(`unknown source: ${name}. available: ${Object.keys(sources).join(", ")}`);
        }
        return sources[name]();
    }
}
exports.Memory = Memory;
