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

 - filename: packages/openmemory-js/src/configuration/envfile.ts
 - what is the file used for: loads local .env files and strips inline comments safely
*/

import fs from "node:fs";
import path from "node:path";

const val = (raw: string) => {
  const txt = raw.trim();
  let q: string | null = null;
  let end = txt.length;

  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if ((ch === "'" || ch === '"') && (i === 0 || txt[i - 1] !== "\\")) q = q === ch ? null : q || ch;
    if (ch === "#" && q === null && (i === 0 || /\s/.test(txt[i - 1]))) {
      end = i;
      break;
    }
  }

  return txt.slice(0, end).trim().replace(/^['"](.*)['"]$/, "$1");
};

const load = (file: string) => {
  try {
    for (const line of fs.readFileSync(file, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = val(m[2] || "");
    }
  } catch {}
};

export const load_env_files = (base = __dirname) => {
  [
    path.resolve(process.cwd(), ".env"),
    path.resolve(base, "../../.env"),
    path.resolve(base, "../../../.env"),
    path.resolve(base, "../../../../.env"),
  ].forEach(load);
};
