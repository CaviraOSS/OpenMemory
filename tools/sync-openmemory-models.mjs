import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const sourcePath = resolve(repoRoot, "models.yml");
const mirrorPath = resolve(repoRoot, "packages", "openmemory-js", "models.yml");
const checkOnly = process.argv.includes("--check");

if (!existsSync(sourcePath)) {
  console.error(`[MODELS] source file not found: ${sourcePath}`);
  process.exit(1);
}

const source = readFileSync(sourcePath, "utf8");
const mirror = existsSync(mirrorPath) ? readFileSync(mirrorPath, "utf8") : null;

if (checkOnly) {
  if (mirror !== source) {
    console.error(
      `[MODELS] package mirror is out of sync with source of truth: ${sourcePath}`,
    );
    console.error(`[MODELS] mirror path: ${mirrorPath}`);
    console.error(
      `[MODELS] run: node tools/sync-openmemory-models.mjs`,
    );
    process.exit(1);
  }

  console.log("[MODELS] package mirror is in sync");
  process.exit(0);
}

if (mirror === source) {
  console.log("[MODELS] package mirror already up to date");
  process.exit(0);
}

writeFileSync(mirrorPath, source, "utf8");
console.log(`[MODELS] synced ${mirrorPath} from ${sourcePath}`);
