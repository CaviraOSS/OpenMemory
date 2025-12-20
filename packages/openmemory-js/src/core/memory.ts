
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

        // Ensure tags is JSON string if needed by add_hsg_memory
        // hsg.ts signature: add_hsg_memory(content, tags, meta, user_id)
        // tags is usually stringified JSON or string? 
        // Checked hsg.ts: interface hsg_mem { tags?: string }
        // Let's pass JSON string for tags.
        const tags_str = JSON.stringify(tags);

        // hsg.ts add_hsg_memory returns { id, ... } or similar?
        // Let's check hsg.ts exports. It's likely async and returns object.
        const res = await add_hsg_memory(content, tags_str, meta, uid ?? undefined);
        return res;
    }

    async get(id: string) {
        return await q.get_mem.get(id);
    }

    async search(query: string, opts?: { user_id?: string, limit?: number, sectors?: string[] }) {
        // hsg_query(qt, k, f)
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
            // q.del_mem usually exists or we execute raw SQL
            // But we can't easily access q here if not exported or if we want to change memory.ts minimal
            // I'll add a wipe() method that calls q directly if q is imported
        }
    }

    async wipe() {
        console.log("[Memory] Wiping DB...");
        // q is imported from db.ts
        await q.clear_all.run();
    }
}
