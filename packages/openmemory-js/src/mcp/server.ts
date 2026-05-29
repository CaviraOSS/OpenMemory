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

 - filename
 - what is the file used for
*/

import { DurableMcpClient, type DurableMcpClientConfig } from "./client";

export const MCP_TOOL_NAMES = [
  "openmemory_store",
  "openmemory_search",
  "openmemory_get",
  "openmemory_list",
  "openmemory_update",
  "openmemory_delete",
  "openmemory_explain",
  "openmemory_ingest",
] as const;

type ToolName = (typeof MCP_TOOL_NAMES)[number];

type ToolDefinition = {
  name: ToolName;
  description: string;
  inputSchema: Record<string, unknown>;
  call: (input: Record<string, unknown>) => Promise<unknown>;
};

const objectSchema = (
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: "object",
  properties,
  required,
  additionalProperties: true,
});

export function createMcpToolRegistry(config: DurableMcpClientConfig = {}) {
  const client = new DurableMcpClient(config);
  const tools: ToolDefinition[] = [
    {
      name: "openmemory_store",
      description: "Create a durable memory.",
      inputSchema: objectSchema({ content: { type: "string" } }, ["content"]),
      call: (input) => client.store(input),
    },
    {
      name: "openmemory_search",
      description: "Search durable memories.",
      inputSchema: objectSchema(
        { query: { type: "string" }, limit: { type: "number" } },
        ["query"],
      ),
      call: (input) => client.search(input),
    },
    {
      name: "openmemory_get",
      description: "Get one durable memory.",
      inputSchema: objectSchema({ id: { type: "string" } }, ["id"]),
      call: (input) => client.get(input as { id: string }),
    },
    {
      name: "openmemory_list",
      description: "List durable memories.",
      inputSchema: objectSchema({
        user_id: { type: "string" },
        project_id: { type: "string" },
        limit: { type: "number" },
        offset: { type: "number" },
      }),
      call: (input) =>
        client.list(input as Record<string, string | number | undefined>),
    },
    {
      name: "openmemory_update",
      description: "Update a durable memory.",
      inputSchema: objectSchema(
        { id: { type: "string" }, content: { type: "string" } },
        ["id"],
      ),
      call: (input) =>
        client.update(input as Record<string, unknown> & { id: string }),
    },
    {
      name: "openmemory_delete",
      description: "Soft-delete a durable memory.",
      inputSchema: objectSchema(
        { id: { type: "string" }, reason: { type: "string" } },
        ["id"],
      ),
      call: (input) => client.delete(input as { id: string }),
    },
    {
      name: "openmemory_explain",
      description: "Explain durable memory provenance and scoring.",
      inputSchema: objectSchema(
        { id: { type: "string" }, recall_query: { type: "string" } },
        ["id"],
      ),
      call: (input) => client.explain(input as { id: string }),
    },
    {
      name: "openmemory_ingest",
      description: "Create a durable ingestion event and extraction candidate.",
      inputSchema: objectSchema(
        { source: { type: "object" }, content: { type: "string" } },
        ["source", "content"],
      ),
      call: (input) => client.ingest(input),
    },
  ];

  return { tools };
}

const dynamicImport = new Function("specifier", "return import(specifier)") as (
  specifier: string,
) => Promise<any>;

export async function startMcpStdio(config: DurableMcpClientConfig = {}) {
  const [{ Server }, { StdioServerTransport }] = await Promise.all([
    dynamicImport("@modelcontextprotocol/sdk/server/index.js"),
    dynamicImport("@modelcontextprotocol/sdk/server/stdio.js"),
  ]);

  const registry = createMcpToolRegistry(config);
  const server = new Server(
    { name: "openmemory-js", version: "1.4.0" },
    { capabilities: { tools: {} } },
  );

  const { ListToolsRequestSchema, CallToolRequestSchema } = await dynamicImport(
    "@modelcontextprotocol/sdk/types.js",
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: registry.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const tool = registry.tools.find(
      (candidate) => candidate.name === request.params.name,
    );
    if (!tool) throw new Error(`unknown tool: ${request.params.name}`);
    const result = await tool.call(request.params.arguments || {});
    return {
      content: [{ type: "text", text: JSON.stringify(result) }],
    };
  });

  await server.connect(new StdioServerTransport());
}
