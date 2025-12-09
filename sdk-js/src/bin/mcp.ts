#!/usr/bin/env node
import { start_mcp_stdio } from "../mcp";

start_mcp_stdio().catch((error) => {
    console.error("[MCP] STDIO startup failed:", error);
    process.exit(1);
});
