import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from '../core/cfg';
import * as path from 'path';
import * as fs from 'fs';

// Manual OpenAPI specification since JSDoc parsing doesn't work well with our custom server
export const swaggerSpec = {
    openapi: '3.0.0',
    info: {
        title: 'OpenMemory API',
        version: '2.0.0',
        description: 'Brain-inspired memory engine for LLMs and AI agents with temporal graph capabilities',
        contact: {
            name: 'OpenMemory',
            url: 'https://github.com/zloeber/openmemory-fork',
        },
        license: {
            name: 'MIT',
            url: 'https://opensource.org/licenses/MIT',
        },
    },
    servers: [
        {
            url: `http://localhost:${env.port}`,
            description: 'Development server',
        },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'JWT token authentication',
            },
            apiKeyAuth: {
                type: 'apiKey',
                in: 'header',
                name: 'x-api-key',
                description: 'API key authentication',
            },
        },
        schemas: {
            Memory: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Unique memory identifier' },
                    content: { type: 'string', description: 'Memory content text' },
                    tags: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Associated tags'
                    },
                    metadata: { 
                        type: 'object',
                        description: 'Additional metadata'
                    },
                    created_at: { 
                        type: 'string', 
                        format: 'date-time',
                        description: 'Creation timestamp'
                    },
                    updated_at: { 
                        type: 'string', 
                        format: 'date-time',
                        description: 'Last update timestamp'
                    },
                    user_id: { 
                        type: 'string',
                        description: 'Associated user ID'
                    },
                    embedding: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Vector embedding'
                    },
                    strength: { 
                        type: 'number',
                        description: 'Memory strength value'
                    },
                },
            },
            TemporalFact: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'Unique fact identifier' },
                    subject: { type: 'string', description: 'Fact subject' },
                    predicate: { type: 'string', description: 'Fact predicate/relationship' },
                    object: { type: 'string', description: 'Fact object/value' },
                    valid_from: { 
                        type: 'string', 
                        format: 'date-time',
                        description: 'Fact validity start time'
                    },
                    valid_to: { 
                        type: 'string', 
                        format: 'date-time',
                        nullable: true,
                        description: 'Fact validity end time'
                    },
                    confidence: { 
                        type: 'number',
                        minimum: 0,
                        maximum: 1,
                        description: 'Confidence level'
                    },
                    last_updated: { 
                        type: 'string', 
                        format: 'date-time',
                        description: 'Last update timestamp'
                    },
                    metadata: { 
                        type: 'object',
                        description: 'Additional metadata'
                    },
                },
            },
            HealthResponse: {
                type: 'object',
                properties: {
                    ok: { type: 'boolean', description: 'Service health status' },
                    version: { type: 'string', description: 'API version' },
                    embedding: { 
                        type: 'object',
                        description: 'Embedding provider information'
                    },
                    tier: { 
                        type: 'string',
                        enum: ['fast', 'smart', 'deep', 'hybrid'],
                        description: 'Performance tier'
                    },
                    dim: { type: 'integer', description: 'Vector dimension' },
                    cache: { type: 'integer', description: 'Cache segments' },
                    expected: {
                        type: 'object',
                        properties: {
                            recall: { type: 'number' },
                            qps: { type: 'string' },
                            ram: { type: 'string' },
                            use: { type: 'string' }
                        }
                    }
                },
            },
            Error: {
                type: 'object',
                properties: {
                    err: { type: 'string', description: 'Error message' },
                },
            },
            AddMemoryRequest: {
                type: 'object',
                required: ['content'],
                properties: {
                    content: { type: 'string', description: 'Memory content text' },
                    tags: { 
                        type: 'array', 
                        items: { type: 'string' },
                        description: 'Associated tags'
                    },
                    metadata: { 
                        type: 'object',
                        description: 'Additional metadata'
                    },
                    user_id: { 
                        type: 'string',
                        description: 'Associated user ID'
                    },
                },
            },
        },
    },
    paths: {
        '/health': {
            get: {
                summary: 'Health check endpoint',
                description: 'Returns the health status of the OpenMemory service along with configuration details',
                tags: ['System'],
                responses: {
                    '200': {
                        description: 'Server health status and configuration',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/HealthResponse'
                                },
                                examples: {
                                    healthy: {
                                        summary: 'Healthy server response',
                                        value: {
                                            ok: true,
                                            version: '2.0-hsg-tiered',
                                            embedding: { provider: 'ollama', dimensions: 256 },
                                            tier: 'hybrid',
                                            dim: 256,
                                            cache: 3,
                                            expected: { recall: 98, qps: '700-800', ram: '0.5gb/10k', use: 'For high accuracy' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/add': {
            post: {
                summary: 'Add a new memory',
                description: 'Store new content as a memory with optional metadata and tags',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                $ref: '#/components/schemas/AddMemoryRequest'
                            },
                            examples: {
                                simple: {
                                    summary: 'Simple memory',
                                    value: {
                                        content: 'User prefers dark mode UI',
                                        tags: ['preference', 'ui']
                                    }
                                },
                                with_metadata: {
                                    summary: 'Memory with metadata',
                                    value: {
                                        content: 'Project deadline is March 15th',
                                        tags: ['project', 'deadline'],
                                        metadata: { priority: 'high', project_id: 'proj_123' },
                                        user_id: 'user_456'
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Memory successfully added',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        primary_sector: { type: 'string' },
                                        sectors: { type: 'array', items: { type: 'string' } },
                                        chunks: { type: 'integer' }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid request - missing content',
                        content: {
                            'application/json': {
                                schema: {
                                    $ref: '#/components/schemas/Error'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/query': {
            post: {
                summary: 'Query memories',
                description: 'Search for memories using semantic similarity',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['query'],
                                properties: {
                                    query: { type: 'string', description: 'Search query text' },
                                    limit: { 
                                        type: 'integer',
                                        minimum: 1,
                                        maximum: 100,
                                        default: 10,
                                        description: 'Maximum number of results'
                                    },
                                    min_similarity: { 
                                        type: 'number',
                                        minimum: 0,
                                        maximum: 1,
                                        default: 0.7,
                                        description: 'Minimum similarity threshold'
                                    },
                                    user_id: { 
                                        type: 'string',
                                        description: 'Filter by user ID'
                                    },
                                    tags: { 
                                        type: 'array', 
                                        items: { type: 'string' },
                                        description: 'Filter by tags'
                                    },
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Query results',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        allOf: [
                                            { $ref: '#/components/schemas/Memory' },
                                            {
                                                type: 'object',
                                                properties: {
                                                    similarity: {
                                                        type: 'number',
                                                        description: 'Similarity score'
                                                    }
                                                }
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/ingest': {
            post: {
                summary: 'Ingest document',
                description: 'Extract and store content from various document formats',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['content_type', 'data'],
                                properties: {
                                    content_type: { 
                                        type: 'string',
                                        enum: ['text/plain', 'text/html', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                                        description: 'Content type'
                                    },
                                    data: { 
                                        type: 'string',
                                        description: 'Base64 encoded content or raw text'
                                    },
                                    metadata: { 
                                        type: 'object',
                                        description: 'Additional metadata'
                                    },
                                    user_id: { 
                                        type: 'string',
                                        description: 'Associated user ID'
                                    },
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Document successfully ingested'
                    }
                }
            }
        },
        '/memory/all': {
            get: {
                summary: 'Get all memories',
                description: 'Retrieve all stored memories with optional pagination',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                parameters: [
                    {
                        in: 'query',
                        name: 'offset',
                        schema: { type: 'integer', minimum: 0, default: 0 },
                        description: 'Number of memories to skip'
                    },
                    {
                        in: 'query',
                        name: 'limit',
                        schema: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
                        description: 'Maximum number of memories to return'
                    }
                ],
                responses: {
                    '200': {
                        description: 'List of memories',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/Memory' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/memory/{id}': {
            get: {
                summary: 'Get memory by ID',
                description: 'Retrieve a specific memory by its unique identifier',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Memory ID'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Memory details',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Memory' }
                            }
                        }
                    },
                    '404': {
                        description: 'Memory not found',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/Error' }
                            }
                        }
                    }
                }
            },
            patch: {
                summary: 'Update memory',
                description: 'Update an existing memory content, tags, or metadata',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Memory ID'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Memory successfully updated'
                    }
                }
            },
            delete: {
                summary: 'Delete memory',
                description: 'Remove a memory from the system',
                tags: ['Memory'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Memory ID'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Memory successfully deleted'
                    }
                }
            }
        },
        '/api/temporal/fact': {
            post: {
                summary: 'Create temporal fact',
                description: 'Add a new temporal fact to the knowledge graph',
                tags: ['Temporal'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['subject', 'predicate', 'object'],
                                properties: {
                                    subject: { type: 'string', description: 'Fact subject' },
                                    predicate: { type: 'string', description: 'Fact predicate/relationship' },
                                    object: { type: 'string', description: 'Fact object/value' },
                                    confidence: { 
                                        type: 'number',
                                        minimum: 0,
                                        maximum: 1,
                                        default: 1.0,
                                        description: 'Confidence level'
                                    },
                                    metadata: { 
                                        type: 'object',
                                        description: 'Additional metadata'
                                    },
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Temporal fact successfully created',
                        content: {
                            'application/json': {
                                schema: { $ref: '#/components/schemas/TemporalFact' }
                            }
                        }
                    }
                }
            },
            get: {
                summary: 'Query temporal facts',
                description: 'Search for temporal facts with optional filters',
                tags: ['Temporal'],
                security: [
                    { bearerAuth: [] },
                    { apiKeyAuth: [] }
                ],
                parameters: [
                    {
                        in: 'query',
                        name: 'subject',
                        schema: { type: 'string' },
                        description: 'Filter by subject'
                    },
                    {
                        in: 'query',
                        name: 'predicate',
                        schema: { type: 'string' },
                        description: 'Filter by predicate'
                    },
                    {
                        in: 'query',
                        name: 'object',
                        schema: { type: 'string' },
                        description: 'Filter by object'
                    }
                ],
                responses: {
                    '200': {
                        description: 'List of matching temporal facts',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: { $ref: '#/components/schemas/TemporalFact' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/sectors': {
            get: {
                summary: 'Get memory sectors',
                description: 'Retrieve information about memory sector configuration',
                tags: ['System'],
                responses: {
                    '200': {
                        description: 'Memory sector configuration',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        sectors: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    name: { type: 'string' },
                                                    config: { type: 'object' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/agents': {
            get: {
                summary: 'List registered agents',
                description: 'Retrieve all registered MCP proxy agents and their configurations',
                tags: ['Agents'],
                responses: {
                    '200': {
                        description: 'List of registered agents',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            agent_id: { type: 'string', description: 'Unique agent identifier' },
                                            namespace: { type: 'string', description: 'Primary namespace' },
                                            permissions: { 
                                                type: 'array', 
                                                items: { type: 'string' },
                                                description: 'Agent permissions'
                                            },
                                            shared_namespaces: {
                                                type: 'array',
                                                items: { type: 'string' },
                                                description: 'Additional accessible namespaces'
                                            },
                                            description: { type: 'string', description: 'Agent description' },
                                            created_at: { type: 'string', format: 'date-time' },
                                            last_access: { type: 'string', format: 'date-time' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            post: {
                summary: 'Register new agent',
                description: 'Register a new MCP proxy agent with namespace access. This endpoint is idempotent - calling it multiple times with the same agent_id will update the existing agent configuration and preserve the original API key.',
                tags: ['Agents'],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['agent_id', 'namespace'],
                                properties: {
                                    agent_id: { 
                                        type: 'string', 
                                        description: 'Unique identifier for the agent' 
                                    },
                                    namespace: { 
                                        type: 'string', 
                                        description: 'Primary namespace for agent memories' 
                                    },
                                    permissions: {
                                        type: 'array',
                                        items: { 
                                            type: 'string',
                                            enum: ['read', 'write', 'admin']
                                        },
                                        default: ['read', 'write'],
                                        description: 'Permissions for the primary namespace'
                                    },
                                    shared_namespaces: {
                                        type: 'array',
                                        items: { type: 'string' },
                                        description: 'Additional namespaces this agent can access'
                                    },
                                    description: { 
                                        type: 'string', 
                                        description: 'Agent description for documentation' 
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'Agent successfully registered or updated',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        success: { type: 'boolean' },
                                        agent_id: { type: 'string' },
                                        api_key: { type: 'string', description: 'API key (preserved if agent already exists)' },
                                        namespace: { type: 'string' },
                                        permissions: { type: 'array', items: { type: 'string' } },
                                        shared_namespaces: { type: 'array', items: { type: 'string' } },
                                        description: { type: 'string' },
                                        message: { type: 'string', description: 'Success message indicating if agent was registered or updated' }
                                    }
                                }
                            }
                        }
                    },
                    '400': {
                        description: 'Invalid registration data',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        error: { type: 'string' },
                                        message: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/agents/{id}': {
            get: {
                summary: 'Get agent details',
                description: 'Retrieve detailed information about a specific agent',
                tags: ['Agents'],
                parameters: [
                    {
                        in: 'path',
                        name: 'id',
                        required: true,
                        schema: { type: 'string' },
                        description: 'Agent ID'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Agent details',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        agent_id: { type: 'string' },
                                        namespace: { type: 'string' },
                                        permissions: { type: 'array', items: { type: 'string' } },
                                        shared_namespaces: { type: 'array', items: { type: 'string' } },
                                        description: { type: 'string' },
                                        created_at: { type: 'string', format: 'date-time' },
                                        last_access: { type: 'string', format: 'date-time' },
                                        access_count: { type: 'number' }
                                    }
                                }
                            }
                        }
                    },
                    '404': {
                        description: 'Agent not found',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        error: { type: 'string' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/namespaces': {
            get: {
                summary: 'List all namespaces',
                description: 'Retrieve all available namespaces and their statistics',
                tags: ['Namespaces'],
                responses: {
                    '200': {
                        description: 'List of namespaces',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'array',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            name: { type: 'string', description: 'Namespace name' },
                                            type: { 
                                                type: 'string', 
                                                enum: ['shared', 'private'],
                                                description: 'Namespace type' 
                                            },
                                            memory_count: { type: 'number', description: 'Number of memories' },
                                            agent_count: { type: 'number', description: 'Number of agents with access' },
                                            description: { type: 'string', description: 'Namespace description' }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/proxy-info': {
            get: {
                summary: 'Get proxy service information',
                description: 'Retrieve MCP proxy service capabilities and statistics',
                tags: ['Proxy'],
                responses: {
                    '200': {
                        description: 'Proxy service information',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        service: { type: 'string' },
                                        version: { type: 'string' },
                                        description: { type: 'string' },
                                        capabilities: {
                                            type: 'object',
                                            properties: {
                                                namespace_isolation: { type: 'boolean' },
                                                agent_registration: { type: 'boolean' },
                                                shared_namespaces: { type: 'boolean' },
                                                api_key_auth: { type: 'boolean' }
                                            }
                                        },
                                        statistics: {
                                            type: 'object',
                                            properties: {
                                                total_agents: { type: 'number' },
                                                total_namespaces: { type: 'number' },
                                                total_requests: { type: 'number' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/proxy-health': {
            get: {
                summary: 'Proxy health check',
                description: 'Check the health status of the MCP proxy service',
                tags: ['Proxy'],
                responses: {
                    '200': {
                        description: 'Proxy service health status',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
                                        timestamp: { type: 'string', format: 'date-time' },
                                        uptime: { type: 'number', description: 'Uptime in seconds' },
                                        database_status: { type: 'string' },
                                        active_connections: { type: 'number' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/api/registration-template/{format}': {
            get: {
                summary: 'Get registration template',
                description: 'Retrieve agent registration template in specified format',
                tags: ['Agents'],
                parameters: [
                    {
                        in: 'path',
                        name: 'format',
                        required: true,
                        schema: { 
                            type: 'string',
                            enum: ['json', 'curl', 'prompt', 'example']
                        },
                        description: 'Template format'
                    }
                ],
                responses: {
                    '200': {
                        description: 'Registration template',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    description: 'Template structure varies by format'
                                }
                            },
                            'text/plain': {
                                schema: {
                                    type: 'string',
                                    description: 'Template as text (for curl format)'
                                }
                            },
                            'text/markdown': {
                                schema: {
                                    type: 'string',
                                    description: 'Template as markdown (for example format)'
                                }
                            }
                        }
                    }
                }
            }
        },
        '/mcp-proxy': {
            post: {
                summary: 'MCP proxy protocol endpoint',
                description: 'Model Context Protocol endpoint for multi-agent namespace management',
                tags: ['MCP'],
                security: [
                    { apiKeyAuth: [] }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    jsonrpc: { type: 'string', enum: ['2.0'] },
                                    method: { 
                                        type: 'string',
                                        enum: ['initialize', 'tools/list', 'tools/call', 'resources/list', 'resources/read']
                                    },
                                    id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                                    params: { type: 'object' }
                                }
                            },
                            examples: {
                                register_agent: {
                                    summary: 'Register new agent',
                                    value: {
                                        jsonrpc: '2.0',
                                        id: 1,
                                        method: 'tools/call',
                                        params: {
                                            name: 'register_agent',
                                            arguments: {
                                                agent_id: 'my-agent-v1',
                                                namespace: 'my-workspace',
                                                permissions: ['read', 'write'],
                                                description: 'My AI assistant'
                                            }
                                        }
                                    }
                                },
                                query_memory: {
                                    summary: 'Query memories',
                                    value: {
                                        jsonrpc: '2.0',
                                        id: 2,
                                        method: 'tools/call',
                                        params: {
                                            name: 'query_memory',
                                            arguments: {
                                                agent_id: 'my-agent-v1',
                                                query: 'machine learning concepts',
                                                k: 5
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': {
                        description: 'MCP JSON-RPC response',
                        content: {
                            'application/json': {
                                schema: {
                                    type: 'object',
                                    properties: {
                                        jsonrpc: { type: 'string', enum: ['2.0'] },
                                        id: { oneOf: [{ type: 'string' }, { type: 'number' }] },
                                        result: { type: 'object' },
                                        error: {
                                            type: 'object',
                                            properties: {
                                                code: { type: 'number' },
                                                message: { type: 'string' },
                                                data: { type: 'object' }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    tags: [
        {
            name: 'System',
            description: 'System health and configuration endpoints',
        },
        {
            name: 'Memory',
            description: 'Core memory management operations',
        },
        {
            name: 'Temporal',
            description: 'Temporal graph fact management',
        },
        {
            name: 'Compression',
            description: 'Memory compression and optimization',
        },
        {
            name: 'Users',
            description: 'User management and summaries',
        },
        {
            name: 'IDE',
            description: 'IDE integration features',
        },
        {
            name: 'Agents',
            description: 'MCP proxy agent registration and management',
        },
        {
            name: 'Namespaces',
            description: 'Namespace management for multi-agent isolation',
        },
        {
            name: 'Proxy',
            description: 'MCP proxy service information and health',
        },
        {
            name: 'MCP',
            description: 'Model Context Protocol endpoints',
        },
    ],
};

export const setupSwagger = (app: any) => {
    // Serve OpenAPI spec as JSON
    app.get('/openapi.json', (req: any, res: any) => {
        res.setHeader('Content-Type', 'application/json');
        res.json(swaggerSpec);
    });

    // Simple Swagger UI HTML page
    app.get('/api-docs', (req: any, res: any) => {
        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>OpenMemory API Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui.css" />
    <style>
        html {
            box-sizing: border-box;
            overflow: -moz-scrollbars-vertical;
            overflow-y: scroll;
        }
        *, *:before, *:after {
            box-sizing: inherit;
        }
        body {
            margin:0;
            background: #fafafa;
        }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@3.52.5/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/openapi.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                supportedSubmitMethods: ['get', 'post', 'put', 'delete', 'patch']
            });
        };
    </script>
</body>
</html>`;
        
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    });

    console.log(`[SWAGGER] OpenAPI documentation available at:`);
    console.log(`  - Swagger UI: http://localhost:${env.port}/api-docs`);
    console.log(`  - OpenAPI spec: http://localhost:${env.port}/openapi.json`);
};