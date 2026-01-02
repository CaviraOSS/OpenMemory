# OpenMemory Client Examples

This directory contains practical examples showing how to use OpenMemory as a library in different scenarios.

## Prerequisites

1. **PostgreSQL Database** with pgvector extension
   - Supabase (recommended - pgvector included)
   - AWS RDS for PostgreSQL
   - Self-hosted PostgreSQL with pgvector

2. **Environment Variables**
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:5432/dbname"
   export OPENAI_API_KEY="sk-..."  # For embeddings
   ```

3. **Install Dependencies**
   ```bash
   npm install
   ```

## Examples

### 1. Basic Usage (`basic-usage.ts`)

Demonstrates core OpenMemory operations:
- Adding memories (episodic, semantic, procedural)
- Querying memories
- Sector-specific queries
- Filtering by salience
- Updating memories
- Listing memories

**Run:**
```bash
DATABASE_URL=postgresql://... tsx examples/basic-usage.ts
```

**What you'll learn:**
- How to initialize the OpenMemory client
- Adding different types of memories with tags and metadata
- Querying across all sectors or specific sectors
- Understanding memory scores and salience
- Basic CRUD operations

### 2. Multi-Tenant Usage (`multi-tenant-usage.ts`)

Shows how to build a multi-tenant SaaS application:
- Isolating data per tenant using `tenant_id`
- Managing memories for multiple customers
- Querying tenant-specific data
- Demonstrating data isolation

**Run:**
```bash
DATABASE_URL=postgresql://... tsx examples/multi-tenant-usage.ts
```

**What you'll learn:**
- Multi-tenant architecture patterns
- Tenant data isolation
- Per-tenant memory queries
- Support agent workflows
- Customer context management

**Use cases:**
- Customer support systems
- Multi-tenant chatbots
- SaaS platforms with per-customer memory
- CRM systems

### 3. Cloud Run / Serverless API (`cloud-run-example.ts`)

Production-ready REST API for serverless deployment:
- Connection pooling and reuse
- Request handling patterns
- Multi-tenant header support
- Graceful shutdown
- Error handling

**Run locally:**
```bash
DATABASE_URL=postgresql://... tsx examples/cloud-run-example.ts
```

**Deploy to Cloud Run:**
```bash
# Build and deploy
gcloud run deploy memory-api \
  --source . \
  --set-env-vars DATABASE_URL=postgresql://... \
  --set-env-vars OPENAI_API_KEY=sk-... \
  --allow-unauthenticated
```

**API Endpoints:**

```bash
# Add memory
curl -X POST https://your-service.run.app/memory \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: customer_123" \
  -d '{"content": "User prefers dark mode"}'

# Query memories
curl "https://your-service.run.app/memory?query=preferences&k=5" \
  -H "x-tenant-id: customer_123"

# List memories
curl "https://your-service.run.app/memories?limit=10"

# Update memory
curl -X PATCH https://your-service.run.app/memory/MEMORY_ID \
  -H "Content-Type: application/json" \
  -d '{"content": "Updated content"}'

# Delete memory
curl -X DELETE https://your-service.run.app/memory/MEMORY_ID
```

**What you'll learn:**
- Serverless deployment patterns
- Connection management in Cloud Run
- REST API design for memory operations
- Multi-tenant header extraction
- Production error handling

**Deploy to:**
- Google Cloud Run
- AWS Lambda (adapt handler)
- Vercel Edge Functions (adapt to edge runtime)
- Cloudflare Workers

## Common Patterns

### Pattern 1: Initialize Once, Use Many Times

**✅ Good - Reuse connection:**
```typescript
// Initialize once (module-level or singleton)
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL
});

// Use across multiple requests
export async function handler(req) {
  await memory.query("...");
}
```

**❌ Bad - Creates new connection per request:**
```typescript
export async function handler(req) {
  const memory = new OpenMemory({
    connectionString: process.env.DATABASE_URL
  });
  await memory.query("...");
}
```

### Pattern 2: Multi-Tenant Request Handling

```typescript
// Extract tenant from request
const getTenantId = (req) => {
  return req.headers['x-tenant-id'] ||
         req.user?.tenant_id ||
         req.query.tenant_id ||
         'default';
};

// Use in query
const results = await memory.query({
  query: "...",
  tenant_id: getTenantId(req)
});
```

### Pattern 3: Batch Operations

```typescript
// Efficient: Batch add in parallel
const items = ["memory 1", "memory 2", "memory 3"];
await Promise.all(
  items.map(content => memory.add(content))
);

// Less efficient: Sequential
for (const item of items) {
  await memory.add(item);
}
```

### Pattern 4: Error Handling

```typescript
try {
  await memory.add({ content: "..." });
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    // Database connection failed
    console.error('Database unavailable:', error);
  } else if (error.message.includes('Invalid tenant_id')) {
    // Invalid tenant
    console.error('Invalid tenant:', error);
  } else {
    // Other errors
    console.error('Unexpected error:', error);
  }
}
```

## Performance Tips

### 1. Use Connection Pooling
OpenMemory automatically uses connection pooling. Initialize once and reuse.

### 2. Enable pgvector
For 100K+ memories, use native pgvector:
```typescript
const memory = new OpenMemory({
  connectionString: process.env.DATABASE_URL,
  pgvector_enabled: true  // O(log n) vs O(n) search
});
```

### 3. Batch Queries
Use `Promise.all()` for parallel operations:
```typescript
const [results1, results2] = await Promise.all([
  memory.query("query 1"),
  memory.query("query 2")
]);
```

### 4. Set Appropriate K
Don't over-fetch:
```typescript
// ✅ Good - fetch what you need
await memory.query({ query: "...", k: 5 });

// ❌ Bad - fetching too many
await memory.query({ query: "...", k: 1000 });
```

## Troubleshooting

### Connection Errors

```
Error: connect ECONNREFUSED
```

**Solution:** Check `DATABASE_URL` and ensure PostgreSQL is running.

### Migration Errors

```
Error: column "tenant_id" does not exist
```

**Solution:** Run migrations manually:
```bash
npm run migrate
```

Or ensure `autoMigrate: true` (default).

### Embedding Errors

```
Error: OpenAI API key not set
```

**Solution:** Set `OPENAI_API_KEY` environment variable.

### Performance Issues

**Slow queries on large datasets?**
- Enable pgvector: `pgvector_enabled: true`
- Check indexes: `EXPLAIN ANALYZE SELECT ...`
- See [PGVECTOR_SETUP.md](../PGVECTOR_SETUP.md)

## Next Steps

- Read [CLIENT_USAGE.md](../CLIENT_USAGE.md) for full API reference
- See [PGVECTOR_SETUP.md](../PGVECTOR_SETUP.md) for production setup
- Check [API.md](../API.md) for advanced features

## Contributing

Have a useful example? Submit a PR!

Examples we'd love to see:
- AWS Lambda handler
- Vercel Edge Function
- Cloudflare Worker
- Next.js API route
- tRPC integration
- GraphQL resolver
