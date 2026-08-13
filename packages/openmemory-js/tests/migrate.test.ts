import sqlite3 from "sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { run_sqlite_migrations } from "../src/core/migrate";

const exec = (db: sqlite3.Database, sql: string): Promise<void> =>
    new Promise((resolve, reject) => {
        db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

const all = <T>(db: sqlite3.Database, sql: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
        db.all(sql, (err, rows) => (err ? reject(err) : resolve(rows as T[])));
    });

const columns = async (db: sqlite3.Database, table: string) => {
    const rows = await all<{ name: string }>(db, `PRAGMA table_info(${table})`);
    return rows.map((row) => row.name);
};

const create_corrupted_v130_schema = async (db: sqlite3.Database) => {
    await exec(
        db,
        `
        CREATE TABLE memories (id TEXT PRIMARY KEY, user_id TEXT, content TEXT);
        CREATE TABLE vectors (id TEXT, sector TEXT, user_id TEXT);
        CREATE TABLE waypoints (src_id TEXT, dst_id TEXT, user_id TEXT);
        CREATE TABLE temporal_facts (id TEXT PRIMARY KEY, user_id TEXT);
        CREATE TABLE schema_version (version TEXT PRIMARY KEY, applied_at INTEGER);

        INSERT INTO memories VALUES ('memory-1', 'user-1', 'keep me');
        INSERT INTO vectors VALUES ('memory-1', 'semantic', 'user-1');
        INSERT INTO waypoints VALUES ('memory-1', 'memory-1', 'user-1');
        INSERT INTO temporal_facts VALUES ('fact-1', 'user-1');
        INSERT INTO schema_version VALUES ('1.3.0', 1);
        `,
    );
};

describe("SQLite schema migrations", () => {
    let db: sqlite3.Database;

    beforeEach(async () => {
        db = new sqlite3.Database(":memory:");
        await create_corrupted_v130_schema(db);
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => {
            db.close((err) => (err ? reject(err) : resolve()));
        });
    });

    it("repairs a database marked 1.3.0 when project_id columns are missing", async () => {
        await run_sqlite_migrations(db);

        for (const table of [
            "memories",
            "vectors",
            "waypoints",
            "temporal_facts",
        ]) {
            expect(await columns(db, table)).toContain("project_id");
        }

        const memories = await all<{ content: string }>(
            db,
            "SELECT content FROM memories",
        );
        expect(memories).toEqual([{ content: "keep me" }]);
    });

    it("is idempotent after repairing the missing 1.3.0 columns", async () => {
        await run_sqlite_migrations(db);
        await run_sqlite_migrations(db);

        const versions = await all<{ version: string }>(
            db,
            "SELECT version FROM schema_version ORDER BY version",
        );
        expect(versions).toEqual([{ version: "1.3.0" }]);

        for (const table of [
            "memories",
            "vectors",
            "waypoints",
            "temporal_facts",
        ]) {
            const projectColumns = (await columns(db, table)).filter(
                (column) => column === "project_id",
            );
            expect(projectColumns).toHaveLength(1);
        }
    });
});
