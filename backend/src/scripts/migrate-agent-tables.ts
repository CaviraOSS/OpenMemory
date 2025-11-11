#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { run_async, get_async } from "../core/db";

const migrationsDir = path.join(__dirname, "../../migrations");

async function runMigration() {
    console.log("Running agent registration migration...");
    
    try {
        // Check if migration has already been run
        const migrationFile = path.join(migrationsDir, "002_agent_registrations.sql");
        
        if (!fs.existsSync(migrationFile)) {
            console.error("Migration file not found:", migrationFile);
            process.exit(1);
        }

        const sql = fs.readFileSync(migrationFile, 'utf8');
        const statements = sql.split(';').filter(stmt => stmt.trim());

        for (const statement of statements) {
            if (statement.trim()) {
                console.log("Executing:", statement.substring(0, 50) + "...");
                await run_async(statement.trim());
            }
        }

        console.log("✅ Agent registration migration completed successfully");

        // Verify tables were created
        const tables = ['agent_registrations', 'namespace_groups', 'agent_access_log'];
        for (const table of tables) {
            try {
                const result = await get_async(`SELECT COUNT(*) as count FROM ${table}`);
                console.log(`📊 Table ${table}: ${result.count} rows`);
            } catch (error) {
                console.warn(`⚠️  Could not verify table ${table}:`, error);
            }
        }

    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

// Run migration if called directly
if (require.main === module) {
    runMigration().then(() => {
        console.log("Migration process completed");
        process.exit(0);
    });
}

export { runMigration };