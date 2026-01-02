#!/usr/bin/env ts-node
/**
 * OpenMemory pgvector Migration Runner
 *
 * This script runs all SQL migrations to upgrade OpenMemory from BYTEA vectors
 * to native pgvector with multi-tenant support.
 *
 * Usage:
 *   npm run migrate
 *
 * Or directly:
 *   OM_PGVECTOR_ENABLED=true ts-node migrations/run_migrations.ts
 *
 * Environment variables required:
 *   OM_PG_HOST - PostgreSQL host
 *   OM_PG_PORT - PostgreSQL port (default: 5432)
 *   OM_PG_DB - Database name
 *   OM_PG_USER - Database user
 *   OM_PG_PASSWORD - Database password
 *   OM_PG_SCHEMA - Schema name (default: public)
 *   OM_VEC_DIM - Vector dimensions (default: 1536)
 *   OM_PG_TABLE - Memories table name (default: openmemory_memories)
 *   OM_VECTOR_TABLE - Vectors table name (default: openmemory_vectors)
 */

import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

interface MigrationConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    schema: string;
    vectorDim: number;
    memoriesTable: string;
    vectorsTable: string;
}

function getConfig(): MigrationConfig {
    const config = {
        host: process.env.OM_PG_HOST || "localhost",
        port: parseInt(process.env.OM_PG_PORT || "5432"),
        database: process.env.OM_PG_DB || "openmemory",
        user: process.env.OM_PG_USER || "postgres",
        password: process.env.OM_PG_PASSWORD || "",
        schema: process.env.OM_PG_SCHEMA || "public",
        vectorDim: parseInt(process.env.OM_VEC_DIM || "1536"),
        memoriesTable: process.env.OM_PG_TABLE || "openmemory_memories",
        vectorsTable: process.env.OM_VECTOR_TABLE || "openmemory_vectors",
    };

    console.log("\n📊 Migration Configuration:");
    console.log(`   Database: ${config.user}@${config.host}:${config.port}/${config.database}`);
    console.log(`   Schema: ${config.schema}`);
    console.log(`   Vector Dimensions: ${config.vectorDim}`);
    console.log(`   Memories Table: ${config.memoriesTable}`);
    console.log(`   Vectors Table: ${config.vectorsTable}\n`);

    return config;
}

function replacePlaceholders(sql: string, config: MigrationConfig): string {
    return sql
        .replace(/\${schema}/g, config.schema)
        .replace(/\${vector_dim}/g, config.vectorDim.toString())
        .replace(/\${memories_table}/g, config.memoriesTable)
        .replace(/\${vectors_table}/g, config.vectorsTable);
}

async function runMigration(pool: Pool, migrationFile: string, config: MigrationConfig): Promise<void> {
    const migrationPath = path.join(__dirname, migrationFile);

    if (!fs.existsSync(migrationPath)) {
        throw new Error(`Migration file not found: ${migrationPath}`);
    }

    console.log(`\n🔄 Running migration: ${migrationFile}`);

    const sql = fs.readFileSync(migrationPath, "utf-8");
    const processedSql = replacePlaceholders(sql, config);

    try {
        await pool.query(processedSql);
        console.log(`✅ Success: ${migrationFile}`);
    } catch (error: any) {
        console.error(`❌ Failed: ${migrationFile}`);
        console.error(`   Error: ${error.message}`);
        throw error;
    }
}

async function checkPgvectorInstalled(pool: Pool): Promise<boolean> {
    try {
        const result = await pool.query(
            "SELECT EXISTS(SELECT 1 FROM pg_extension WHERE extname = 'vector') AS installed"
        );
        return result.rows[0].installed;
    } catch (error) {
        return false;
    }
}

async function main() {
    const config = getConfig();

    const pool = new Pool({
        host: config.host,
        port: config.port,
        database: config.database,
        user: config.user,
        password: config.password,
    });

    try {
        console.log("\n🚀 OpenMemory pgvector Migration\n");
        console.log("=" .repeat(60));

        // Test connection
        await pool.query("SELECT 1");
        console.log("✅ Database connection successful\n");

        // Check if pgvector is already installed
        const pgvectorInstalled = await checkPgvectorInstalled(pool);

        if (pgvectorInstalled) {
            console.log("ℹ️  pgvector extension is already installed");
        } else {
            console.log("⚠️  pgvector extension not found");
            console.log("   The migration will attempt to install it.");
            console.log("   If this fails, install it manually:");
            console.log("   - Supabase: Already installed by default");
            console.log("   - AWS RDS: Enable via rds.extensions parameter");
            console.log("   - Self-hosted: https://github.com/pgvector/pgvector\n");
        }

        // Confirm before proceeding
        console.log("⚠️  WARNING: This migration will modify your database schema!");
        console.log("   - Add tenant_id columns to all tables");
        console.log("   - Convert BYTEA vectors to pgvector type");
        console.log("   - Create HNSW indexes (may take 1-2 hours for large datasets)");
        console.log("   - Update primary keys for multi-tenancy\n");

        const readline = require("readline").createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        const answer = await new Promise<string>((resolve) => {
            readline.question("Continue with migration? (yes/no): ", resolve);
        });
        readline.close();

        if (answer.toLowerCase() !== "yes") {
            console.log("\n❌ Migration cancelled by user");
            process.exit(0);
        }

        console.log("\n" + "=".repeat(60));

        // Run migrations in order
        const migrations = [
            "001_enable_pgvector.sql",
            "002_add_tenant_id.sql",
            "003_convert_vectors_to_pgvector.sql",
            "004_update_primary_keys.sql",
            "005_create_indexes.sql",
        ];

        for (const migration of migrations) {
            await runMigration(pool, migration, config);
        }

        console.log("\n" + "=".repeat(60));
        console.log("\n🎉 All migrations completed successfully!\n");
        console.log("Next steps:");
        console.log("1. Update your .env file:");
        console.log("   OM_MULTI_TENANT=true");
        console.log("   OM_PGVECTOR_ENABLED=true");
        console.log("   OM_DEFAULT_TENANT_ID=your-tenant-id");
        console.log("\n2. Restart your OpenMemory server");
        console.log("\n3. Test with a sample query to verify pgvector is working");
        console.log("\n4. Monitor query performance with:");
        console.log("   EXPLAIN ANALYZE SELECT * FROM vectors WHERE ...\n");

    } catch (error: any) {
        console.error("\n❌ Migration failed!");
        console.error(`   Error: ${error.message}`);
        console.error("\n   Your database may be in an incomplete state.");
        console.error("   Please review the error and run the migrations manually if needed.\n");
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main();
