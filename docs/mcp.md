# MCP

MCP support remains inside `packages/openmemory-js`, but it is not the focus of the current cleanup.

For now, MCP is registered by the JavaScript server when it builds cleanly.
Keep MCP changes limited to the package and avoid adding separate app or
editor-extension surfaces.

The durable rewrite should preserve memory tools through the JS server once the core remember, recall, and explain flows are stable.
