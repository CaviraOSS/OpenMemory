/*
   ____                   __  __                                 
  / __ \                 |  \/  |                                
 | |  | |_ __   ___ _ __ | \  / | ___ _ __ ___   ___  _ __ _   _ 
 | |  | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 | |__| | |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
  \____/| .__/ \___|_| |_|_|  |_|\___|_| |_| |_|\___/|_|   \__, |
        | |                                                 __/ |
        |_|                                                |___/ 
  CaviraOSS @ 2026

 - filename
 - what is the file used for
*/

export interface MemoryOptions {
  user_id?: string;
  project_id?: string;
  tags?: string[];
  [key: string]: any;
}

export class Memory {
  default_user: string | null;

  constructor(user_id?: string) {
    this.default_user = user_id || null;
  }

  async add(content: string, opts?: MemoryOptions) {
    const { rememberDurableMemory } = await import("../durable/repository");
    const { embed } = await import("../embeddings/embed");
    const db = await durableExecutor();
    const uid = opts?.user_id || this.default_user;
    const proj = opts?.project_id || null;
    const tags = opts?.tags || [];

    const meta = { ...opts };
    delete meta.user_id;
    delete meta.project_id;
    delete meta.tags;

    return await rememberDurableMemory(db, {
      content,
      user_id: uid ?? undefined,
      project_id: proj ?? undefined,
      facets: tags.length > 0 ? { tags } : undefined,
      metadata: meta,
      embedding: await embed(content),
    });
  }

  async get(id: string) {
    const { getDurableMemory } = await import("../durable/repository");
    return await getDurableMemory(await durableExecutor(), {
      id,
      user_id: this.default_user ?? undefined,
    });
  }

  async search(
    query: string,
    opts?: {
      user_id?: string;
      project_id?: string;
      limit?: number;
    },
  ) {
    const { recallDurableMemories } = await import("../durable/repository");
    const { embed } = await import("../embeddings/embed");
    const k = opts?.limit || 10;
    const uid = opts?.user_id || this.default_user;
    const proj = opts?.project_id || null;

    return await recallDurableMemories(await durableExecutor(), {
      query,
      limit: k,
      user_id: uid ?? undefined,
      project_id: proj ?? undefined,
      embedding: await embed(query),
    });
  }

  async delete_all(user_id?: string) {
    const { listDurableMemories, deleteDurableMemory } =
      await import("../durable/repository");
    const db = await durableExecutor();
    const uid = user_id || this.default_user;
    if (!uid) {
      throw new Error("delete_all requires a user_id");
    }

    let deleted = 0;
    for (;;) {
      const page = await listDurableMemories(db, {
        user_id: uid,
        limit: 100,
        offset: 0,
      });
      if (page.items.length === 0) break;
      for (const memory of page.items) {
        if (await deleteDurableMemory(db, { id: memory.id, user_id: uid })) {
          deleted++;
        }
      }
    }
    return { deleted };
  }

  async wipe() {
    throw new Error("wipe is not supported by the durable SDK");
  }
}

async function durableExecutor() {
  const connection = await import("../database/connection");
  return {
    query: async (sql: string, params: unknown[] = []) => {
      const command = sql.trim().toUpperCase();
      if (command === "BEGIN") {
        await connection.transaction.begin();
        return { rows: [] };
      }
      if (command === "COMMIT") {
        await connection.transaction.commit();
        return { rows: [] };
      }
      if (command === "ROLLBACK") {
        await connection.transaction.rollback();
        return { rows: [] };
      }
      if (/^\s*select\b/i.test(sql)) {
        return { rows: await connection.all_async(sql, params as any[]) };
      }

      await connection.run_async(sql, params as any[]);
      return { rows: [] };
    },
  };
}
