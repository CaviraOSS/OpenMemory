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

 - filename: packages/openmemory-js/src/database/legacymigrationreport.ts
 - what is the file used for: prints a non-destructive legacy data migration report
*/

import fs from "node:fs";
import { buildLegacyMigrationReport } from "../durable/migrationReport";

const read = (p: string) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

const main = async () => {
  const src = process.argv[2] || process.env.OM_LEGACY_REPORT_INPUT;
  const out = process.argv[3] || process.env.OM_LEGACY_REPORT_OUTPUT;
  if (!src) {
    console.error("usage: npm run migration-report -- <legacy-data.json> [report.json]");
    process.exit(1);
  }
  const txt = JSON.stringify(buildLegacyMigrationReport(read(src)), null, 2);
  out ? fs.writeFileSync(out, `${txt}\n`) : console.log(txt);
};

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
