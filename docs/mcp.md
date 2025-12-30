# MCP Server Reference

OpenMemory provides a Model Context Protocol (MCP) server that exposes memory operations as tools for AI assistants like Claude, Cursor, and Windsurf.

## Setup

### Installation

```bash
# Use via npx (no installation needed)
npx -y openmemory-js mcp

# Or install globally
npm install -g openmemory-js
openmemory-js mcp
```

### Configuration

Configure your MCP client (`.mcp.json` for Cursor/Windsurf, or Claude settings):

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "npx",
      "args": ["-y", "openmemory-js", "mcp"],
      "env": {
        "OM_METADATA_BACKEND": "sqlite",
        "OM_EMBEDDINGS": "openai",
        "OPENAI_API_KEY": "your-api-key"
      }
    }
  }
}
```

#### Environment Variables

- `OM_METADATA_BACKEND`: Database type (`sqlite` or `postgres`)
- `OM_EMBEDDINGS`: Embedding provider (`openai`, `aws`, `ollama`, `synthetic`)
- Database credentials (if using Postgres): `OM_PG_HOST`, `OM_PG_DB`, `OM_PG_USER`, `OM_PG_PASSWORD`

## Memory Systems

OpenMemory provides two complementary memory systems:

### Contextual Memory (HSG)
Semantic memory organized into cognitive sectors (episodic, semantic, procedural, emotional, reflective) with vector-based retrieval.

**Best for:** Conversations, rich context, experiential memories

### Temporal Facts
Structured facts (subject-predicate-object triples) with time-based validity and automatic invalidation.

**Best for:** Preferences, business rules, configurations that change over time

## Available Tools

### openmemory_store

Store content in contextual memory, temporal facts, or both.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `content` | string | Yes | - | Raw memory text |
| `type` | enum | No | "contextual" | Storage type: "contextual", "factual", or "both" |
| `facts` | array | Conditional | - | Facts array (required if type is "factual" or "both") |
| `tags` | string[] | No | - | Tags for contextual storage |
| `metadata` | object | No | - | Additional metadata |
| `user_id` | string | No | - | User identifier |

#### Facts Array Schema

```typescript
{
  subject: string,      // Entity (e.g., "user_123", "client_acme")
  predicate: string,    // Relationship (e.g., "prefers_format", "approval_limit")
  object: string,       // Value (e.g., "Excel", "50000")
  confidence?: number,  // 0-1 score (default: 1.0)
  valid_from?: string   // ISO date (default: now)
}
```

#### Examples

**Store contextual memory:**
```json
{
  "content": "User prefers morning meetings",
  "tags": ["preference", "scheduling"],
  "user_id": "user_123"
}
```

**Store temporal fact:**
```json
{
  "content": "Client prefers Excel format",
  "type": "factual",
  "facts": [{
    "subject": "client_acme",
    "predicate": "prefers_report_format",
    "object": "Excel"
  }],
  "user_id": "user_123"
}
```

**Store in both systems:**
```json
{
  "content": "Approval threshold updated to $75K",
  "type": "both",
  "facts": [{
    "subject": "expense_policy",
    "predicate": "approval_threshold_usd",
    "object": "75000"
  }],
  "tags": ["policy", "threshold"],
  "user_id": "user_123"
}
```

### openmemory_query

Query contextual memories, temporal facts, or both.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search text |
| `type` | enum | No | "contextual" | Query type: "contextual", "factual", or "unified" |
| `fact_pattern` | object | No | - | Pattern for temporal queries |
| `at` | string | No | now | ISO date for point-in-time queries |
| `k` | number | No | 8 | Max results for contextual queries |
| `sector` | enum | No | - | Filter by sector (episodic, semantic, procedural, emotional, reflective) |
| `min_salience` | number | No | - | Minimum salience threshold (0-1) |
| `user_id` | string | No | - | User identifier |

#### Fact Pattern Schema

```typescript
{
  subject?: string,    // Entity to match (undefined = wildcard)
  predicate?: string,  // Relationship to match (undefined = wildcard)
  object?: string      // Value to match (undefined = wildcard)
}
```

#### Examples

**Query contextual memories:**
```json
{
  "query": "user preferences",
  "user_id": "user_123"
}
```

**Query current facts:**
```json
{
  "query": "client report format",
  "type": "factual",
  "fact_pattern": {
    "subject": "client_acme",
    "predicate": "prefers_report_format"
  }
}
```

**Historical query:**
```json
{
  "query": "Q3 approval limit",
  "type": "factual",
  "fact_pattern": {
    "subject": "expense_policy",
    "predicate": "approval_threshold_usd"
  },
  "at": "2023-09-30T00:00:00Z"
}
```

**Unified query:**
```json
{
  "query": "client information",
  "type": "unified",
  "fact_pattern": {
    "subject": "client_acme"
  },
  "k": 10,
  "user_id": "user_123"
}
```

### openmemory_list

List recent memories.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `limit` | number | No | 10 | Number of memories to return (max 50) |
| `sector` | enum | No | - | Filter by sector |
| `user_id` | string | No | - | User identifier |

#### Example

```json
{
  "limit": 20,
  "sector": "semantic",
  "user_id": "user_123"
}
```

### openmemory_get

Fetch a single memory by ID.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Memory identifier |
| `include_vectors` | boolean | No | false | Include sector vector metadata |
| `user_id` | string | No | - | User identifier |

#### Example

```json
{
  "id": "mem_abc123",
  "include_vectors": true,
  "user_id": "user_123"
}
```

### openmemory_reinforce

Boost salience of a memory.

#### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `id` | string | Yes | - | Memory identifier |
| `boost` | number | No | 0.1 | Salience boost amount (0.01-1.0) |

#### Example

```json
{
  "id": "mem_abc123",
  "boost": 0.15
}
```

## Response Formats

### openmemory_store

**Contextual storage:**
```json
{
  "type": "contextual",
  "hsg": {
    "id": "mem_abc123",
    "primary_sector": "semantic",
    "sectors": ["semantic", "procedural"]
  }
}
```

**Factual storage:**
```json
{
  "type": "factual",
  "temporal": [{
    "id": "fact_xyz789",
    "subject": "client_acme",
    "predicate": "prefers_format",
    "object": "Excel",
    "valid_from": "2024-01-15T10:00:00.000Z",
    "confidence": 0.95
  }]
}
```

### openmemory_query

**Contextual query:**
```json
{
  "type": "contextual",
  "contextual": [{
    "source": "hsg",
    "id": "mem_abc123",
    "score": 0.8921,
    "content": "User prefers morning meetings...",
    "primary_sector": "semantic",
    "salience": 0.756
  }]
}
```

**Factual query:**
```json
{
  "type": "factual",
  "factual": [{
    "source": "temporal",
    "id": "fact_xyz789",
    "subject": "client_acme",
    "predicate": "prefers_format",
    "object": "Excel",
    "confidence": 0.95,
    "valid_from": "2024-01-15T10:00:00.000Z",
    "valid_to": null
  }]
}
```

**Unified query:**
```json
{
  "type": "unified",
  "contextual": [...],  // HSG results
  "factual": [...]      // Temporal facts
}
```

## Key Features

### Automatic Fact Invalidation

When storing a fact with the same subject+predicate, the previous fact is automatically closed:

```
Day 1: Store (client_acme, prefers_format, PDF)
       → Stored with valid_to = null

Day 2: Store (client_acme, prefers_format, Excel)  
       → Old fact: valid_to = Day 2 (closed)
       → New fact: valid_to = null (current)
```

### Point-in-Time Queries

Query what was true at any historical date:

```json
{
  "type": "factual",
  "fact_pattern": {"subject": "client_acme", "predicate": "prefers_format"},
  "at": "2024-01-10T00:00:00Z"
}
```

Returns the fact that was valid on January 10th, even if it's since been updated.

### Wildcard Patterns

Use undefined fields in `fact_pattern` for wildcards:

```json
// All facts about client_acme
{"subject": "client_acme"}

// All preferences for any subject
{"predicate": "prefers"}

// All facts with object "Excel"
{"object": "Excel"}
```

## Best Practices

### Storage Type Selection

| Type | Use Case | Example |
|------|----------|---------|
| `contextual` | Rich narratives, conversations | "Team discussed the Q4 strategy..." |
| `factual` | Structured data that changes | client_acme prefers_format Excel |
| `both` | Rich context with extractable facts | "Client wants monthly Excel reports" |

### Fact Naming Conventions

**Subject:** Specific entity identifier
- ✅ `user_123`, `client_acme_corp`, `expense_policy`
- ❌ `the user`, `client`, `policy`

**Predicate:** Clear relationship in snake_case
- ✅ `prefers_report_format`, `requires_approval_at`, `uses_data_source`
- ❌ `preference`, `requirement`, `uses`

**Object:** Concrete value
- ✅ `Excel`, `50000`, `Salesforce_CRM`
- ❌ `file format`, `high`, `CRM system`

### Query Strategy

**Use `type="contextual"` when:**
- Asking open-ended questions
- Needing semantic similarity
- Searching conversations

**Use `type="factual"` when:**
- Asking for specific current values
- Querying structured data
- Need historical accuracy

**Use `type="unified"` when:**
- Need comprehensive context
- Unsure which system has the answer
- Want both semantic context AND facts

## Integration Examples

### Claude Desktop

```json
{
  "mcpServers": {
    "openmemory": {
      "command": "npx",
      "args": ["-y", "openmemory-js", "mcp"]
    }
  }
}
```

### Cursor / Windsurf

Add to `.cursorrules` or `.windsurfrules`:

```
When storing user information, use openmemory_store:
- type="contextual" for conversations
- type="factual" for preferences that may change
- Always include user_id parameter

When querying, use openmemory_query:
- type="unified" for comprehensive context
- Construct fact_pattern for specific fact queries
```

### Programmatic (Node.js)

```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({
  name: 'my-app',
  version: '1.0.0'
}, { capabilities: {} });

const transport = new StdioClientTransport({
  command: 'npx',
  args: ['-y', 'openmemory-js', 'mcp']
});

await client.connect(transport);

// Store memory
await client.callTool({
  name: 'openmemory_store',
  arguments: {
    content: "User prefers concise responses",
    type: "both",
    facts: [{
      subject: "user_123",
      predicate: "prefers_response_style",
      object: "concise"
    }],
    user_id: "user_123"
  }
});

// Query
const result = await client.callTool({
  name: 'openmemory_query',
  arguments: {
    query: "user preferences",
    type: "unified",
    user_id: "user_123"
  }
});
```

## Common Patterns

### Track Evolving Preferences

```json
// Initial preference
{
  "content": "Client prefers PDF reports",
  "type": "both",
  "facts": [{"subject": "client_x", "predicate": "prefers_format", "object": "PDF"}]
}

// Updated preference (automatically invalidates old fact)
{
  "content": "Client now prefers Excel reports",
  "type": "both",
  "facts": [{"subject": "client_x", "predicate": "prefers_format", "object": "Excel"}]
}

// Query current preference
{
  "query": "client report format",
  "type": "factual",
  "fact_pattern": {"subject": "client_x", "predicate": "prefers_format"}
}
// Returns: Excel
```

### Historical Analysis

```json
// What was true last quarter?
{
  "query": "approval threshold in Q3",
  "type": "factual",
  "fact_pattern": {
    "subject": "expense_policy",
    "predicate": "approval_threshold_usd"
  },
  "at": "2023-09-30T00:00:00Z"
}
```

### Comprehensive Context

```json
// Get both conversations and facts
{
  "query": "client requirements",
  "type": "unified",
  "fact_pattern": {"subject": "client_x"},
  "k": 10
}
// Returns: Discussions + current facts
```

## Database Schema

### Contextual Memory Tables
- `memories` / `openmemory_memories` - Memory content and metadata
- `vectors` / `openmemory_vectors` - Sector-specific embeddings
- `waypoints` / `openmemory_waypoints` - Associative graph connections

### Temporal Graph Tables
- `temporal_facts` - Subject-predicate-object facts with validity periods
- `temporal_edges` - Relationships between facts

Both SQLite and Postgres are supported.

## Troubleshooting

### "Facts array is required" Error

When using `type="factual"` or `type="both"`, you must provide the `facts` parameter:

```json
{
  "content": "...",
  "type": "factual",
  "facts": [{ "subject": "...", "predicate": "...", "object": "..." }]
}
```

### Empty Temporal Results

If `type="factual"` returns no results:
1. Verify facts were stored with correct subject/predicate
2. Check `at` parameter matches validity period
3. Use wildcards in fact_pattern to broaden search

### Connection Issues

Ensure environment variables are set:
- Postgres: `OM_PG_HOST`, `OM_PG_DB`, `OM_PG_USER`, `OM_PG_PASSWORD`
- Embeddings: `OPENAI_API_KEY` (or relevant provider key)

## Performance

- **Contextual queries:** ~50-200ms (vector similarity + graph traversal)
- **Factual queries:** ~5-20ms (indexed SQL lookups)
- **Unified queries:** Run in parallel, total ≈ max(contextual, factual)

## See Also

- [Node SDK](./node-sdk.md) - Direct API usage in Node.js applications
- [Python SDK](./python-sdk.md) - Direct API usage in Python applications
- [Getting Started](./getting-started.md) - Installation and setup guide
