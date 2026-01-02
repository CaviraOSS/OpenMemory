/**
 * Google Cloud Run Example
 *
 * This example shows how to use OpenMemory in a Cloud Run service.
 * The key pattern is to initialize OpenMemory ONCE outside the request handler
 * so the connection is reused across requests for better performance.
 *
 * Deploy to Cloud Run:
 *   1. Set DATABASE_URL secret in Cloud Run
 *   2. Deploy: gcloud run deploy memory-api --source .
 *
 * This creates a simple REST API for memory operations:
 *   POST   /memory      - Add a memory
 *   GET    /memory      - Query memories
 *   PATCH  /memory/:id  - Update a memory
 *   DELETE /memory/:id  - Delete a memory
 */

import express from 'express';
import { OpenMemory } from '../packages/openmemory-js/src/client';

// Initialize OpenMemory ONCE at startup (not per request!)
// This allows connection pooling and better performance
const memory = new OpenMemory({
    connectionString: process.env.DATABASE_URL,
    tenant_id: process.env.DEFAULT_TENANT_ID || 'default',
    pgvector_enabled: true,
    autoMigrate: true  // Auto-run migrations on first startup
});

const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', service: 'openmemory-api' });
});

// Add a memory
app.post('/memory', async (req, res) => {
    try {
        const { content, tags, metadata, user_id, tenant_id } = req.body;

        if (!content) {
            return res.status(400).json({ error: 'content is required' });
        }

        // Extract tenant_id from header or use default
        const resolvedTenantId = tenant_id ||
            req.headers['x-tenant-id'] ||
            process.env.DEFAULT_TENANT_ID ||
            'default';

        const result = await memory.add({
            content,
            tags,
            metadata,
            user_id,
            tenant_id: resolvedTenantId as string
        });

        res.json({
            success: true,
            id: result.id,
            message: 'Memory added successfully'
        });

    } catch (error: any) {
        console.error('Error adding memory:', error);
        res.status(500).json({
            error: 'Failed to add memory',
            message: error.message
        });
    }
});

// Query memories
app.get('/memory', async (req, res) => {
    try {
        const {
            query,
            k,
            sectors,
            minSalience,
            user_id,
            tenant_id
        } = req.query;

        if (!query) {
            return res.status(400).json({ error: 'query parameter is required' });
        }

        // Extract tenant_id from header or query
        const resolvedTenantId = tenant_id as string ||
            req.headers['x-tenant-id'] as string ||
            process.env.DEFAULT_TENANT_ID ||
            'default';

        const results = await memory.query({
            query: query as string,
            k: k ? parseInt(k as string) : 10,
            sectors: sectors ? (sectors as string).split(',') : undefined,
            minSalience: minSalience ? parseFloat(minSalience as string) : undefined,
            user_id: user_id as string,
            tenant_id: resolvedTenantId
        });

        res.json({
            success: true,
            count: results.length,
            results: results.map(r => ({
                id: r.id,
                content: r.content,
                score: r.score,
                sector: r.primary_sector,
                sectors: r.sectors,
                salience: r.salience,
                tags: r.tags,
                metadata: r.meta,
                last_seen: new Date(r.last_seen_at).toISOString()
            }))
        });

    } catch (error: any) {
        console.error('Error querying memories:', error);
        res.status(500).json({
            error: 'Failed to query memories',
            message: error.message
        });
    }
});

// Update a memory
app.patch('/memory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { content, tags, metadata, tenant_id } = req.body;

        const resolvedTenantId = tenant_id ||
            req.headers['x-tenant-id'] as string ||
            process.env.DEFAULT_TENANT_ID ||
            'default';

        const result = await memory.update({
            id,
            content,
            tags,
            metadata,
            tenant_id: resolvedTenantId
        });

        res.json({
            success: true,
            id: result.id,
            updated: result.updated
        });

    } catch (error: any) {
        console.error('Error updating memory:', error);
        res.status(500).json({
            error: 'Failed to update memory',
            message: error.message
        });
    }
});

// Delete a memory
app.delete('/memory/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { tenant_id } = req.query;

        const resolvedTenantId = tenant_id as string ||
            req.headers['x-tenant-id'] as string ||
            process.env.DEFAULT_TENANT_ID ||
            'default';

        await memory.delete(id, resolvedTenantId);

        res.json({
            success: true,
            message: 'Memory deleted successfully'
        });

    } catch (error: any) {
        console.error('Error deleting memory:', error);
        res.status(500).json({
            error: 'Failed to delete memory',
            message: error.message
        });
    }
});

// List memories with pagination
app.get('/memories', async (req, res) => {
    try {
        const { limit = '50', offset = '0', user_id } = req.query;

        const memories = await memory.list(
            parseInt(limit as string),
            parseInt(offset as string),
            user_id as string
        );

        res.json({
            success: true,
            count: memories.length,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string),
            memories: memories.map(m => ({
                id: m.id,
                content: m.content,
                sector: m.primary_sector,
                salience: m.salience,
                tags: m.tags ? m.tags.split(',') : [],
                created_at: new Date(m.created_at).toISOString(),
                updated_at: new Date(m.updated_at).toISOString()
            }))
        });

    } catch (error: any) {
        console.error('Error listing memories:', error);
        res.status(500).json({
            error: 'Failed to list memories',
            message: error.message
        });
    }
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing connections...');
    await memory.close();
    process.exit(0);
});

// Start server
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
    console.log(`🚀 OpenMemory API listening on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Add memory:   POST http://localhost:${PORT}/memory`);
    console.log(`   Query:        GET http://localhost:${PORT}/memory?query=...`);
});

// Example requests:
/*

# Add a memory
curl -X POST http://localhost:8080/memory \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: customer_123" \
  -d '{
    "content": "User prefers dark mode",
    "tags": ["ui", "preferences"],
    "metadata": {"theme": "dark"}
  }'

# Query memories
curl "http://localhost:8080/memory?query=user+preferences&k=5" \
  -H "x-tenant-id: customer_123"

# List memories
curl "http://localhost:8080/memories?limit=10&offset=0"

# Update a memory
curl -X PATCH http://localhost:8080/memory/some-id \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: customer_123" \
  -d '{
    "content": "User prefers dark mode and compact layout",
    "tags": ["ui", "preferences", "layout"]
  }'

# Delete a memory
curl -X DELETE "http://localhost:8080/memory/some-id?tenant_id=customer_123"

*/
