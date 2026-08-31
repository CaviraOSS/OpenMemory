/*
*      __                      __  ___
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
                     /____/                                 /____/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/core/connectors/sync_cursor.ts
 *  usage : implements the LongMemory sync cursor component
 */


export type sync_item_state = {
    checksum: string;
    version: string;
    node_ids: string[];
    synced_at: number;
    deleted: boolean;
};

export type SyncCursor = {
    connector_id: string;
    position: string | null;
    updated_at: number;
    items: Record<string, sync_item_state>;
    metadata: Record<string, unknown>;
};

export class memory_cursor_store {
    private cursor: SyncCursor | null = null;

    async get(): Promise<SyncCursor | null> {
        return this.cursor ? structuredClone(this.cursor) : null;
    }

    async set(cursor: SyncCursor): Promise<void> {
        this.cursor = structuredClone(cursor);
    }
}

export const empty_cursor = (connector_id: string, now = Date.now()): SyncCursor => ({
    connector_id, position: null, updated_at: now, items: {}, metadata: {},
});