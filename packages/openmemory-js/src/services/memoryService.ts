import { add_hsg_memory, hsg_query } from "../retention/hsg";
import { q, vector_store } from "../database/connection";

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
    const proj = opts?.project_id || null;
    const tags = opts?.tags || [];

    const meta = { ...opts };
    delete meta.user_id;
    delete meta.project_id;
    delete meta.tags;

    const tags_str = JSON.stringify(tags);

    return await add_hsg_memory(
      content,
      tags_str,
      meta,
      uid ?? undefined,
      proj ?? undefined,
    );
  }

  async get(id: string) {
    return await q.get_mem.get(id);
  }

  async search(
    query: string,
    opts?: {
      user_id?: string;
      project_id?: string;
      limit?: number;
      sectors?: string[];
    },
  ) {
    const k = opts?.limit || 10;
    const uid = opts?.user_id || this.default_user;
    const proj = opts?.project_id || null;
    const f: any = {};

    if (uid) f.user_id = uid;
    if (proj) f.project_id = proj;
    if (opts?.sectors) f.sectors = opts.sectors;

    return await hsg_query(query, k, f);
  }

  async delete_all(user_id?: string) {
    const uid = user_id || this.default_user;
    if (!uid) {
      throw new Error("delete_all requires a user_id");
    }

    const memories = await q.all_mem_by_user.all(uid, 10000, 0);
    for (const memory of memories) {
      await q.del_mem.run(memory.id);
      await vector_store.deleteVectors(memory.id);
      await q.del_waypoints.run(memory.id, memory.id);
    }
    return { deleted: memories.length };
  }

  async wipe() {
    await q.clear_all.run();
  }

  source(name: string) {
    const sources: Record<string, any> = {
      github: () =>
        import("../providers/github").then(
          (m) => new m.github_source(this.default_user ?? undefined),
        ),
      notion: () =>
        import("../providers/notion").then(
          (m) => new m.notion_source(this.default_user ?? undefined),
        ),
      googleDrive: () =>
        import("../providers/googleDrive").then(
          (m) => new m.googleDrive_source(this.default_user ?? undefined),
        ),
      googleSheets: () =>
        import("../providers/googleSheets").then(
          (m) => new m.googleSheets_source(this.default_user ?? undefined),
        ),
      googleSlides: () =>
        import("../providers/googleSlides").then(
          (m) => new m.googleSlides_source(this.default_user ?? undefined),
        ),
      onedrive: () =>
        import("../providers/onedrive").then(
          (m) => new m.onedrive_source(this.default_user ?? undefined),
        ),
      webCrawler: () =>
        import("../providers/webCrawler").then(
          (m) => new m.webCrawler_source(this.default_user ?? undefined),
        ),
    };

    if (!(name in sources)) {
      throw new Error(
        `unknown source: ${name}. available: ${Object.keys(sources).join(", ")}`,
      );
    }

    return sources[name]();
  }
}
