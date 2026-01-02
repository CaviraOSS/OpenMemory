/**
 * OpenMemory Client - Library-style SDK for direct database usage
 *
 * This client allows you to use OpenMemory directly in your code without spinning up a server.
 * Ideal for serverless environments like Cloud Run, Lambda, or Edge Functions.
 *
 * @example
 * ```typescript
 * import { OpenMemory } from 'openmemory-js';
 *
 * const memory = new OpenMemory({
 *   connectionString: process.env.DATABASE_URL,
 *   tenant_id: 'customer_123'
 * });
 *
 * await memory.add("User prefers dark mode");
 * const results = await memory.query("What are the user's preferences?");
 * ```
 */

import { Pool, PoolConfig } from "pg";
import * as fs from "fs";
import * as path from "path";
import { add_hsg_memory, hsg_query, update_memory, hsg_q_result } from "./memory/hsg";
import { vector_store } from "./core/db";
import { resolveTenantId, isValidTenantId } from "./core/tenant";

export interface OpenMemoryConfig {
    /**
     * PostgreSQL connection string (e.g., "postgresql://user:pass@host:5432/db")
     * Or Supabase connection string
     */
    connectionString?: string;

    /**
     * Alternative: Provide connection details separately
     */
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
    ssl?: boolean | { rejectUnauthorized: boolean };

    /**
     * Tenant ID for multi-tenant mode
     * If not provided, uses 'default'
     */
    tenant_id?: string;

    /**
     * Default user ID for memory operations
     */
    user_id?: string;

    /**
     * PostgreSQL schema (default: 'public')
     */
    schema?: string;

    /**
     * Enable pgvector (default: true)
     */
    pgvector_enabled?: boolean;

    /**
     * Vector dimensions (default: 1536 for OpenAI text-embedding-3-small)
     */
    vec_dim?: number;

    /**
     * Auto-run migrations on first interaction (default: true)
     */
    autoMigrate?: boolean;

    /**
     * Multi-tenant mode (default: false)
     */
    multi_tenant?: boolean;
}

export interface AddMemoryOptions {
    content: string;
    tags?: string[];
    metadata?: any;
    user_id?: string;
    tenant_id?: string;
}

export interface QueryOptions {
    query: string;
    k?: number;
    sectors?: string[];
    minSalience?: number;
    user_id?: string;
    tenant_id?: string;
    startTime?: number;
    endTime?: number;
}

export interface UpdateMemoryOptions {
    id: string;
    content?: string;
    tags?: string[];
    metadata?: any;
    tenant_id?: string;
}

export class OpenMemory {
    private config: OpenMemoryConfig;
    private pool: Pool | null = null;
    private initialized: boolean = false;
    private initializing: Promise<void> | null = null;
    private migrationRun: boolean = false;

    constructor(config: OpenMemoryConfig) {
        this.config = {
            pgvector_enabled: true,
            vec_dim: 1536,
            schema: 'public',
            autoMigrate: true,
            multi_tenant: false,
            tenant_id: 'default',
            ...config,
        };

        // Validate tenant_id
        if (this.config.tenant_id && !isValidTenantId(this.config.tenant_id)) {
            throw new Error(`Invalid tenant_id: ${this.config.tenant_id}`);
        }

        // Set environment variables for the core modules to use
        this.setEnvVars();
    }

    /**
     * Set environment variables based on config
     * This allows the existing db.ts and other modules to work correctly
     */
    private setEnvVars(): void {
        if (this.config.connectionString) {
            const url = new URL(this.config.connectionString);
            process.env.OM_PG_HOST = url.hostname;
            process.env.OM_PG_PORT = url.port || '5432';
            process.env.OM_PG_DB = url.pathname.slice(1);
            process.env.OM_PG_USER = url.username;
            process.env.OM_PG_PASSWORD = url.password;

            // Handle SSL from connection string
            if (url.searchParams.has('sslmode')) {
                const sslmode = url.searchParams.get('sslmode');
                process.env.OM_PG_SSL = sslmode === 'require' ? 'require' : 'disable';
            }
        } else {
            if (this.config.host) process.env.OM_PG_HOST = this.config.host;
            if (this.config.port) process.env.OM_PG_PORT = this.config.port.toString();
            if (this.config.database) process.env.OM_PG_DB = this.config.database;
            if (this.config.user) process.env.OM_PG_USER = this.config.user;
            if (this.config.password) process.env.OM_PG_PASSWORD = this.config.password;
            if (this.config.ssl === true) process.env.OM_PG_SSL = 'require';
            else if (this.config.ssl === false) process.env.OM_PG_SSL = 'disable';
        }

        process.env.OM_METADATA_BACKEND = 'postgres';
        process.env.OM_VECTOR_BACKEND = 'postgres';
        process.env.OM_PG_SCHEMA = this.config.schema || 'public';
        process.env.OM_PGVECTOR_ENABLED = this.config.pgvector_enabled ? 'true' : 'false';
        process.env.OM_VEC_DIM = (this.config.vec_dim || 1536).toString();
        process.env.OM_MULTI_TENANT = this.config.multi_tenant ? 'true' : 'false';
        process.env.OM_DEFAULT_TENANT_ID = this.config.tenant_id || 'default';
    }

    /**
     * Initialize the database connection and optionally run migrations
     */
    private async init(): Promise<void> {
        if (this.initialized) return;
        if (this.initializing) return this.initializing;

        this.initializing = (async () => {
            try {
                // Import and initialize db module (this will set up the global pool)
                await import("./core/db");

                // Run migrations if enabled and not already run
                if (this.config.autoMigrate && !this.migrationRun) {
                    await this.runMigrations();
                    this.migrationRun = true;
                }

                this.initialized = true;
            } catch (error) {
                this.initializing = null;
                throw error;
            }
        })();

        return this.initializing;
    }

    /**
     * Run database migrations automatically
     */
    private async runMigrations(): Promise<void> {
        // Create a separate pool for migrations
        const poolConfig: PoolConfig = {};

        if (this.config.connectionString) {
            const url = new URL(this.config.connectionString);
            poolConfig.host = url.hostname;
            poolConfig.port = parseInt(url.port || '5432');
            poolConfig.database = url.pathname.slice(1);
            poolConfig.user = url.username;
            poolConfig.password = url.password;

            if (url.searchParams.has('sslmode') && url.searchParams.get('sslmode') === 'require') {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
        } else {
            poolConfig.host = this.config.host;
            poolConfig.port = this.config.port;
            poolConfig.database = this.config.database;
            poolConfig.user = this.config.user;
            poolConfig.password = this.config.password;
            if (this.config.ssl === true) {
                poolConfig.ssl = { rejectUnauthorized: false };
            }
        }

        const pool = new Pool(poolConfig);

        try {
            console.log("[OpenMemory] Running database migrations...");

            // Check if pgvector is installed
            const pgvectorCheck = await pool.query(
                "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed"
            );

            if (!pgvectorCheck.rows[0].installed && this.config.pgvector_enabled) {
                console.log("[OpenMemory] Enabling pgvector extension...");
                await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
            }

            // Check if migrations are needed by looking for tenant_id column
            const columnsCheck = await pool.query(`
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = $1
                AND table_name = $2
                AND column_name = 'tenant_id'
            `, [this.config.schema, process.env.OM_PG_TABLE || 'openmemory_memories']);

            if (columnsCheck.rows.length === 0 && this.config.multi_tenant) {
                console.log("[OpenMemory] Running multi-tenant migrations...");
                await this.runMigrationFiles(pool);
            } else {
                console.log("[OpenMemory] Database schema is up to date");
            }
        } catch (error: any) {
            console.error("[OpenMemory] Migration error:", error.message);
            // Don't throw - allow the app to continue if migrations fail
            // The db.ts init will create basic tables anyway
        } finally {
            await pool.end();
        }
    }

    /**
     * Run migration SQL files
     */
    private async runMigrationFiles(pool: Pool): Promise<void> {
        const migrationsDir = path.join(__dirname, '../migrations');
        const migrations = [
            "001_enable_pgvector.sql",
            "002_add_tenant_id.sql",
            "003_convert_vectors_to_pgvector.sql",
            "004_update_primary_keys.sql",
            "005_create_indexes.sql",
        ];

        const config = {
            schema: this.config.schema || 'public',
            vector_dim: this.config.vec_dim || 1536,
            memories_table: process.env.OM_PG_TABLE || 'openmemory_memories',
            vectors_table: process.env.OM_VECTOR_TABLE || 'openmemory_vectors',
        };

        for (const migration of migrations) {
            const migrationPath = path.join(migrationsDir, migration);

            if (!fs.existsSync(migrationPath)) {
                console.warn(`[OpenMemory] Migration file not found: ${migration}`);
                continue;
            }

            try {
                console.log(`[OpenMemory] Running ${migration}...`);
                const sql = fs.readFileSync(migrationPath, 'utf-8');
                const processedSql = sql
                    .replace(/\${schema}/g, config.schema)
                    .replace(/\${vector_dim}/g, config.vector_dim.toString())
                    .replace(/\${memories_table}/g, config.memories_table)
                    .replace(/\${vectors_table}/g, config.vectors_table);

                await pool.query(processedSql);
                console.log(`[OpenMemory] ✓ ${migration}`);
            } catch (error: any) {
                console.error(`[OpenMemory] Failed: ${migration}`, error.message);
                throw error;
            }
        }
    }

    /**
     * Add a memory to the database
     */
    async add(options: AddMemoryOptions | string): Promise<{ id: string }> {
        await this.init();

        // Handle string shorthand
        const opts = typeof options === 'string'
            ? { content: options }
            : options;

        const tenant_id = opts.tenant_id || this.config.tenant_id || 'default';
        const user_id = opts.user_id || this.config.user_id || 'anonymous';

        const tagsStr = opts.tags ? opts.tags.join(',') : undefined;

        const result = await add_hsg_memory(
            opts.content,
            tagsStr,
            opts.metadata,
            user_id,
            tenant_id
        );

        return { id: result.id };
    }

    /**
     * Query memories from the database
     */
    async query(options: QueryOptions | string): Promise<hsg_q_result[]> {
        await this.init();

        // Handle string shorthand
        const opts = typeof options === 'string'
            ? { query: options }
            : options;

        const tenant_id = opts.tenant_id || this.config.tenant_id || 'default';
        const user_id = opts.user_id || this.config.user_id;
        const k = opts.k || 10;

        const filters = {
            sectors: opts.sectors,
            minSalience: opts.minSalience,
            user_id,
            tenant_id,
            startTime: opts.startTime,
            endTime: opts.endTime,
        };

        return await hsg_query(opts.query, k, filters);
    }

    /**
     * Update an existing memory
     */
    async update(options: UpdateMemoryOptions): Promise<{ id: string; updated: boolean }> {
        await this.init();

        const tenant_id = options.tenant_id || this.config.tenant_id || 'default';

        return await update_memory(
            options.id,
            options.content,
            options.tags,
            options.metadata,
            tenant_id
        );
    }

    /**
     * Delete a memory by ID
     */
    async delete(id: string, tenant_id?: string): Promise<void> {
        await this.init();

        const resolved_tenant_id = tenant_id || this.config.tenant_id || 'default';

        // Delete vectors
        await vector_store.deleteVectors(id, resolved_tenant_id);

        // Delete memory record (using the global q from db.ts)
        const { q } = await import("./core/db");
        await q.del_mem.run(id);
    }

    /**
     * Get a memory by ID
     */
    async get(id: string): Promise<any> {
        await this.init();

        const { q } = await import("./core/db");
        return await q.get_mem.get(id);
    }

    /**
     * List all memories with pagination
     */
    async list(limit: number = 50, offset: number = 0, user_id?: string): Promise<any[]> {
        await this.init();

        const { q } = await import("./core/db");

        if (user_id) {
            return await q.all_mem_by_user.all(user_id, limit, offset);
        }

        return await q.all_mem.all(limit, offset);
    }

    /**
     * Close the database connection
     */
    async close(): Promise<void> {
        if (this.pool) {
            await this.pool.end();
            this.pool = null;
            this.initialized = false;
        }
    }
}

/**
 * Factory function for creating OpenMemory instances
 */
export function createMemory(config: OpenMemoryConfig): OpenMemory {
    return new OpenMemory(config);
}

// Export types
export type { hsg_q_result, AddMemoryOptions, QueryOptions, UpdateMemoryOptions };
