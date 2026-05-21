import fs from "node:fs";
import path from "node:path";

const parseEnvValue = (raw: string) => {
  let value = raw.trim();
  let quote: string | null = null;
  let end = value.length;

  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if ((char === "'" || char === '"') && (i === 0 || value[i - 1] !== "\\")) {
      quote = quote === char ? null : quote || char;
    }
    if (
      char === "#" &&
      quote === null &&
      (i === 0 || /\s/.test(value[i - 1]))
    ) {
      end = i;
      break;
    }
  }

  value = value.slice(0, end).trim();
  return value.replace(/^['"](.*)['"]$/, "$1");
};

const loadEnv = (envPath: string) => {
  try {
    const content = fs.readFileSync(envPath, "utf-8");
    content.split("\n").forEach((line) => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (!match) return;

      const key = match[1];
      if (!process.env[key]) {
        process.env[key] = parseEnvValue(match[2] || "");
      }
    });
  } catch {
    // Optional local config file.
  }
};

export function loadEnvFiles(baseDir: string = __dirname) {
  [
    path.resolve(process.cwd(), ".env"),
    path.resolve(baseDir, "../../.env"),
    path.resolve(baseDir, "../../../.env"),
    path.resolve(baseDir, "../../../../.env"),
  ].forEach(loadEnv);
}
