# OpenMemory Client - Library Usage Guide

This guide shows how to use OpenMemory as a library in your application without running a separate server. Perfect for serverless environments like Cloud Run, AWS Lambda, or Edge Functions.

## Quick Start

### Installation

```bash
npm install openmemory-js
```

### Basic Usage

```typescript
import { OpenMemory } from 'openmemory-js';

// Initialize with Supabase
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  tenant_id: 'customer_123',
  user_id: 'user_456'
});

// Add a memory
await memory.add("User prefers dark mode and compact layout");

// Query memories
const results = await memory.query("What are the user's UI preferences?");
console.log(results[0].content);
// Output: "User prefers dark mode and compact layout"
```

## Configuration Options

### Using Connection String (Recommended for Supabase)

```typescript
const memory = new OpenMemory({
  connectionString: "postgresql://user:pass@host:5432/dbname",
  tenant_id: "customer_123",
  pgvector_enabled: true,  // Enable native pgvector (recommended)
  vec_dim: 1536,           // OpenAI text-embedding-3-small
  autoMigrate: true        // Auto-run migrations on first use
});
```

### Using Separate Connection Details

```typescript
const memory = new OpenMemory({
  host: "db.example.com",
  port: 5432,
  database: "openmemory",
  user: "postgres",
  password: "your_password",
  ssl: true,
  tenant_id: "customer_123"
});
```

### Configuration Reference

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `connectionString` | `string` | - | PostgreSQL connection string |
| `host` | `string` | - | Database host |
| `port` | `number` | 5432 | Database port |
| `database` | `string` | - | Database name |
| `user` | `string` | - | Database user |
| `password` | `string` | - | Database password |
| `ssl` | `boolean \| object` | false | Enable SSL |
| `tenant_id` | `string` | 'default' | Tenant ID for multi-tenancy |
| `user_id` | `string` | 'anonymous' | Default user ID |
| `schema` | `string` | 'public' | PostgreSQL schema |
| `pgvector_enabled` | `boolean` | true | Use native pgvector |
| `vec_dim` | `number` | 1536 | Vector dimensions |
| `autoMigrate` | `boolean` | true | Auto-run migrations |
| `multi_tenant` | `boolean` | false | Enable multi-tenant mode |

## Usage Examples

### 1. Adding Memories

#### Simple String

```typescript
await memory.add("User's favorite color is blue");
```

#### With Tags and Metadata

```typescript
await memory.add({
  content: "Meeting scheduled with Sarah on Friday at 2pm",
  tags: ["meeting", "calendar", "work"],
  metadata: {
    priority: "high",
    participants: ["Sarah", "John"],
    location: "Conference Room A"
  }
});
```

#### With Custom Tenant/User

```typescript
await memory.add({
  content: "Project deadline is next Tuesday",
  user_id: "user_789",
  tenant_id: "company_acme"
});
```

### 2. Querying Memories

#### Basic Query

```typescript
const results = await memory.query("What meetings do I have?");

results.forEach(result => {
  console.log(result.content);
  console.log(`Score: ${result.score}, Salience: ${result.salience}`);
});
```

#### Advanced Query with Filters

```typescript
const results = await memory.query({
  query: "What are the project deadlines?",
  k: 5,                    // Return top 5 results
  sectors: ["episodic"],   // Only search episodic memories
  minSalience: 0.5,        // Minimum salience threshold
  startTime: Date.now() - 7 * 24 * 60 * 60 * 1000,  // Last 7 days
  endTime: Date.now()
});
```

#### Sector-Specific Queries

```typescript
// Query emotional memories
const emotional = await memory.query({
  query: "How did I feel about the presentation?",
  sectors: ["emotional"],
  k: 3
});

// Query procedural memories (how-to knowledge)
const procedural = await memory.query({
  query: "How do I deploy the application?",
  sectors: ["procedural"],
  k: 5
});

// Query semantic memories (facts and concepts)
const semantic = await memory.query({
  query: "What is the capital of France?",
  sectors: ["semantic"],
  k: 1
});
```

### 3. Updating Memories

```typescript
// Get the memory ID from a query result
const results = await memory.query("dark mode preference");
const memoryId = results[0].id;

// Update the memory
await memory.update({
  id: memoryId,
  content: "User prefers dark mode and large fonts",
  tags: ["ui", "preferences", "accessibility"]
});
```

### 4. Deleting Memories

```typescript
await memory.delete(memoryId);
```

### 5. Listing Memories

```typescript
// List all memories (paginated)
const memories = await memory.list(50, 0);  // limit: 50, offset: 0

// List memories for a specific user
const userMemories = await memory.list(50, 0, "user_456");
```

### 6. Getting a Specific Memory

```typescript
const mem = await memory.get(memoryId);
console.log(mem.content);
console.log(mem.primary_sector);
console.log(mem.tags);
```

## Multi-Tenant Usage

### Setup

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  multi_tenant: true,
  tenant_id: "default"  // Can be overridden per operation
});
```

### Per-Operation Tenant ID

```typescript
// Add memory for tenant A
await memory.add({
  content: "Customer A prefers email notifications",
  tenant_id: "customer_a"
});

// Add memory for tenant B
await memory.add({
  content: "Customer B prefers SMS notifications",
  tenant_id: "customer_b"
});

// Query for specific tenant
const resultsA = await memory.query({
  query: "notification preferences",
  tenant_id: "customer_a"
});
```

## Serverless Examples

### Google Cloud Run

```typescript
import { OpenMemory } from 'openmemory-js';

// Initialize once (outside request handler for connection reuse)
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  tenant_id: process.env.TENANT_ID
});

export async function handler(req, res) {
  if (req.method === 'POST') {
    const { content } = req.body;
    const result = await memory.add(content);
    res.json(result);
  } else if (req.method === 'GET') {
    const { query } = req.query;
    const results = await memory.query(query);
    res.json(results);
  }
}
```

### AWS Lambda

```typescript
import { OpenMemory } from 'openmemory-js';

const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  tenant_id: process.env.TENANT_ID
});

export const handler = async (event) => {
  const { action, content, query } = JSON.parse(event.body);

  if (action === 'add') {
    const result = await memory.add(content);
    return {
      statusCode: 200,
      body: JSON.stringify(result)
    };
  } else if (action === 'query') {
    const results = await memory.query(query);
    return {
      statusCode: 200,
      body: JSON.stringify(results)
    };
  }
};
```

### Vercel Edge Functions

```typescript
import { OpenMemory } from 'openmemory-js';

const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL
});

export default async function handler(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  const results = await memory.query(query || "");

  return new Response(JSON.stringify(results), {
    headers: { 'content-type': 'application/json' }
  });
}
```

## Memory Sectors

OpenMemory organizes memories into 5 cognitive sectors:

### 1. **Episodic** (Experiences & Events)
- Personal experiences and events
- Time-based memories ("yesterday I...", "last week we...")
- Decay: Medium-fast (λ=0.015)

```typescript
await memory.add("Had lunch with Sarah at the new Italian restaurant");
```

### 2. **Semantic** (Facts & Knowledge)
- General knowledge and facts
- Concepts and definitions
- Decay: Slow (λ=0.005)

```typescript
await memory.add("Paris is the capital of France");
```

### 3. **Procedural** (How-To Knowledge)
- Instructions and procedures
- Step-by-step guides
- Decay: Medium (λ=0.008)

```typescript
await memory.add("To deploy: run 'npm build' then 'gcloud run deploy'");
```

### 4. **Emotional** (Feelings & Sentiments)
- Emotional responses and feelings
- Sentiment-rich memories
- Decay: Fast (λ=0.02) - emotions fade quickly

```typescript
await memory.add("I felt really proud of the team after the successful launch");
```

### 5. **Reflective** (Meta-Cognitive)
- Self-reflection and insights
- Patterns and realizations
- Decay: Slow (λ=0.006)

```typescript
await memory.add("I've noticed I work better in the mornings");
```

## Environment Variables

If you prefer to configure via environment variables instead of code:

```bash
# Database connection
OM_PG_HOST=db.example.com
OM_PG_PORT=5432
OM_PG_DB=openmemory
OM_PG_USER=postgres
OM_PG_PASSWORD=your_password
OM_PG_SCHEMA=public

# pgvector configuration
OM_PGVECTOR_ENABLED=true
OM_VEC_DIM=1536

# Multi-tenancy
OM_MULTI_TENANT=true
OM_DEFAULT_TENANT_ID=default

# Embedding API (OpenAI)
OM_OPENAI_API_KEY=sk-...
```

Then initialize with minimal config:

```typescript
const memory = new OpenMemory({
  tenant_id: "customer_123"  // Other config comes from env vars
});
```

## Performance Tips

### 1. Connection Reuse
Initialize OpenMemory once and reuse it across requests:

```typescript
// ✅ Good - initialize once
const memory = new OpenMemory({ connectionString: process.env.DATABASE_URL });

export async function handler(req) {
  await memory.query("...");
}
```

```typescript
// ❌ Bad - creates new connection on every request
export async function handler(req) {
  const memory = new OpenMemory({ connectionString: process.env.DATABASE_URL });
  await memory.query("...");
}
```

### 2. Use pgvector for Large Datasets
For 1M+ memories, enable pgvector with HNSW indexes:

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  pgvector_enabled: true,  // Native vector search
  vec_dim: 1536
});
```

### 3. Batch Operations
When adding multiple memories, consider batching:

```typescript
const memories = [
  "Memory 1",
  "Memory 2",
  "Memory 3"
];

await Promise.all(memories.map(content => memory.add(content)));
```

## Migrations

### Automatic Migrations (Default)
By default, migrations run automatically on first interaction:

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  autoMigrate: true  // Default
});

// Migrations run automatically on first add/query
await memory.add("First memory");
```

### Disable Auto-Migration
For production environments where you want manual control:

```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  autoMigrate: false
});
```

Then run migrations manually:

```bash
npm run migrate
```

## Error Handling

```typescript
try {
  const memory = new OpenMemory({
    connectionString: process.env.DATABASE_URL,
    tenant_id: "customer_123"
  });

  await memory.add("Some content");
  const results = await memory.query("search query");

} catch (error) {
  if (error.message.includes("connection")) {
    console.error("Database connection failed:", error);
  } else if (error.message.includes("Invalid tenant_id")) {
    console.error("Invalid tenant ID:", error);
  } else {
    console.error("Unexpected error:", error);
  }
}
```

## TypeScript Support

OpenMemory is written in TypeScript and includes full type definitions:

```typescript
import {
  OpenMemory,
  OpenMemoryConfig,
  AddMemoryOptions,
  QueryOptions,
  hsg_q_result
} from 'openmemory-js';

const config: OpenMemoryConfig = {
  connectionString: process.env.DATABASE_URL,
  tenant_id: "customer_123"
};

const memory = new OpenMemory(config);

const result: hsg_q_result[] = await memory.query("search");
```

## Cleanup

Close the connection when your application shuts down:

```typescript
// Graceful shutdown
process.on('SIGTERM', async () => {
  await memory.close();
  process.exit(0);
});
```

## Next Steps

- See [PGVECTOR_SETUP.md](./PGVECTOR_SETUP.md) for production deployment guide
- Check [examples/](./examples/) for more code samples
- Read the [API Reference](./API.md) for detailed method documentation
