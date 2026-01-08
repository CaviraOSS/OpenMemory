
import { add_hsg_memory, hsg_query } from "../memory/hsg";
import { q, log_maint_op } from "./db";
import { env } from "./cfg";
import { j } from "../utils";

export interface MemoryOptions {
    user_id?: string;
    tags?: string[];
    [key: string]: any;
}

export class Memory {
    default_user: string | null;

    constructor(user_id?: string) {
        this.default_user = user_id || null;
    }

    async add(content: string, opts?: MemoryOptions) {
        const uid = opts?.user_id || this.default_user;
        const tags = opts?.tags || [];
        const meta = { ...opts };
        delete meta.user_id;
        delete meta.tags;






        const tags_str = JSON.stringify(tags);



        const res = await add_hsg_memory(content, tags_str, meta, uid ?? undefined);
        return res;
    }

    async get(id: string) {
        return await q.get_mem.get(id);
    }

    async search(query: string, opts?: { user_id?: string, limit?: number, sectors?: string[] }) {

        const k = opts?.limit || 10;
        const uid = opts?.user_id || this.default_user;
        const f: any = {};
        if (uid) f.user_id = uid;
        if (opts?.sectors) f.sectors = opts.sectors;

        return await hsg_query(query, k, f);
    }

    async delete_all(user_id?: string) {
        const uid = user_id || this.default_user;
        if (uid) {



        }
    }

    async wipe() {
        console.log("[Memory] Wiping DB...");

        await q.clear_all.run();
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
    source(name: string) {

        const sources: Record<string, any> = {
            github: () => import("../sources/github").then(m => new m.github_source(this.default_user ?? undefined)),
            notion: () => import("../sources/notion").then(m => new m.notion_source(this.default_user ?? undefined)),
            google_drive: () => import("../sources/google_drive").then(m => new m.google_drive_source(this.default_user ?? undefined)),
            google_sheets: () => import("../sources/google_sheets").then(m => new m.google_sheets_source(this.default_user ?? undefined)),
            google_slides: () => import("../sources/google_slides").then(m => new m.google_slides_source(this.default_user ?? undefined)),
            onedrive: () => import("../sources/onedrive").then(m => new m.onedrive_source(this.default_user ?? undefined)),
            web_crawler: () => import("../sources/web_crawler").then(m => new m.web_crawler_source(this.default_user ?? undefined)),
        };

        if (!(name in sources)) {
            throw new Error(`unknown source: ${name}. available: ${Object.keys(sources).join(", ")}`);
        }

        return sources[name]();
    }
}
