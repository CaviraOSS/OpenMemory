import * as fs from "fs";
import * as path from "path";

export function resolveOpenMemoryMcpServerPath(explicitPath?: string): string {
    if (explicitPath && explicitPath.trim()) return explicitPath;

    const cwd = process.cwd();
    const candidates = [
        path.join(cwd, "packages", "openmemory-js", "dist", "ai", "mcp.js"),
        path.join(cwd, "backend", "dist", "ai", "mcp.js"), // legacy layout
        path.join(cwd, "sdk-js", "dist", "ai", "mcp.js"), // legacy layout
    ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    // Prefer the current monorepo layout as the default.
    return candidates[0];
}

