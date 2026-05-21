import fs from "node:fs";
import { buildLegacyMigrationReport } from "../durable/migrationReport";

function readJson(path: string) {
  return JSON.parse(fs.readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
}

async function main() {
  const inputPath = process.argv[2] || process.env.OM_LEGACY_REPORT_INPUT;
  const outputPath = process.argv[3] || process.env.OM_LEGACY_REPORT_OUTPUT;

  if (!inputPath) {
    console.error(
      "usage: npm run migration-report -- <legacy-data.json> [report.json]",
    );
    process.exit(1);
  }

  const report = buildLegacyMigrationReport(readJson(inputPath));
  const serialized = JSON.stringify(report, null, 2);

  if (outputPath) {
    fs.writeFileSync(outputPath, `${serialized}\n`);
  } else {
    console.log(serialized);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
