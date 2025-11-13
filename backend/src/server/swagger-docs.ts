/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     description: Returns the health status of the OpenMemory service along with configuration details
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server health status and configuration
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/HealthResponse'
 *             examples:
 *               healthy:
 *                 summary: Healthy server response
 *                 value:
 *                   ok: true
 *                   version: "2.0-hsg-tiered"
 *                   embedding: { provider: "openai", model: "text-embedding-3-small" }
 *                   tier: "hybrid"
 *                   dim: 256
 *                   cache: 3
 *                   expected: { recall: 98, qps: "700-800", ram: "0.5gb/10k", use: "For high accuracy" }
 */

/**
 * @swagger
 * /memory/add:
 *   post:
 *     summary: Add a new memory
 *     description: Store new content as a memory with optional metadata and tags
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddMemoryRequest'
 *           examples:
 *             simple:
 *               summary: Simple memory
 *               value:
 *                 content: "User prefers dark mode UI"
 *                 tags: ["preference", "ui"]
 *             with_metadata:
 *               summary: Memory with metadata
 *               value:
 *                 content: "Project deadline is March 15th"
 *                 tags: ["project", "deadline"]
 *                 metadata: { priority: "high", project_id: "proj_123" }
 *                 user_id: "user_456"
 *     responses:
 *       200:
 *         description: Memory successfully added
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Memory'
 *       400:
 *         description: Invalid request - missing content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /memory/query:
 *   post:
 *     summary: Query memories
 *     description: Search for memories using semantic similarity
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QueryMemoryRequest'
 *           examples:
 *             basic_query:
 *               summary: Basic search query
 *               value:
 *                 query: "user interface preferences"
 *                 limit: 5
 *             filtered_query:
 *               summary: Filtered search with tags
 *               value:
 *                 query: "project deadlines"
 *                 limit: 10
 *                 min_similarity: 0.8
 *                 tags: ["project"]
 *                 user_id: "user_456"
 *     responses:
 *       200:
 *         description: Query results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 allOf:
 *                   - $ref: '#/components/schemas/Memory'
 *                   - type: object
 *                     properties:
 *                       similarity:
 *                         type: number
 *                         description: Similarity score
 *       400:
 *         description: Invalid query parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /memory/ingest:
 *   post:
 *     summary: Ingest document
 *     description: Extract and store content from various document formats
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/IngestRequest'
 *           examples:
 *             text_document:
 *               summary: Plain text document
 *               value:
 *                 content_type: "text/plain"
 *                 data: "This is the content of my document..."
 *                 metadata: { source: "user_upload", filename: "notes.txt" }
 *             pdf_document:
 *               summary: PDF document (base64 encoded)
 *               value:
 *                 content_type: "application/pdf"
 *                 data: "JVBERi0xLjQKJcOkw7zDssOgCjIgMCBvYmoKPDwKL..."
 *                 user_id: "user_123"
 *     responses:
 *       200:
 *         description: Document successfully ingested
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 memories:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Memory'
 *                 chunks_processed:
 *                   type: integer
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /memory/ingest/url:
 *   post:
 *     summary: Ingest content from URL
 *     description: Extract and store content from a web URL
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [url]
 *             properties:
 *               url:
 *                 type: string
 *                 format: uri
 *                 description: URL to ingest content from
 *               metadata:
 *                 type: object
 *                 description: Additional metadata
 *               user_id:
 *                 type: string
 *                 description: Associated user ID
 *           examples:
 *             web_article:
 *               summary: Web article ingestion
 *               value:
 *                 url: "https://example.com/article"
 *                 metadata: { source: "web_scrape" }
 *                 user_id: "user_123"
 *     responses:
 *       200:
 *         description: URL content successfully ingested
 *       400:
 *         description: Invalid URL or request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /memory/all:
 *   get:
 *     summary: Get all memories
 *     description: Retrieve all stored memories with optional pagination
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of memories to skip
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 1000
 *           default: 100
 *         description: Maximum number of memories to return
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *     responses:
 *       200:
 *         description: List of memories
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Memory'
 */

/**
 * @swagger
 * /memory/{id}:
 *   get:
 *     summary: Get memory by ID
 *     description: Retrieve a specific memory by its unique identifier
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Memory ID
 *     responses:
 *       200:
 *         description: Memory details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Memory'
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   patch:
 *     summary: Update memory
 *     description: Update an existing memory's content, tags, or metadata
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Memory ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated memory content
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated tags
 *               metadata:
 *                 type: object
 *                 description: Updated metadata
 *     responses:
 *       200:
 *         description: Memory successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Memory'
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   delete:
 *     summary: Delete memory
 *     description: Remove a memory from the system
 *     tags: [Memory]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Memory ID
 *     responses:
 *       200:
 *         description: Memory successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: true
 *       404:
 *         description: Memory not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/temporal/fact:
 *   post:
 *     summary: Create temporal fact
 *     description: Add a new temporal fact to the knowledge graph
 *     tags: [Temporal]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateTemporalFactRequest'
 *           examples:
 *             user_preference:
 *               summary: User preference fact
 *               value:
 *                 subject: "user:john_doe"
 *                 predicate: "prefers"
 *                 object: "dark_mode_ui"
 *                 confidence: 0.9
 *                 metadata: { source: "user_settings" }
 *     responses:
 *       200:
 *         description: Temporal fact successfully created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemporalFact'
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *   get:
 *     summary: Query temporal facts
 *     description: Search for temporal facts with optional filters
 *     tags: [Temporal]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: subject
 *         schema:
 *           type: string
 *         description: Filter by subject
 *       - in: query
 *         name: predicate
 *         schema:
 *           type: string
 *         description: Filter by predicate
 *       - in: query
 *         name: object
 *         schema:
 *           type: string
 *         description: Filter by object
 *       - in: query
 *         name: at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Query facts valid at specific time
 *       - in: query
 *         name: min_confidence
 *         schema:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           default: 0.1
 *         description: Minimum confidence threshold
 *     responses:
 *       200:
 *         description: List of matching temporal facts
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TemporalFact'
 */

/**
 * @swagger
 * /api/temporal/fact/current:
 *   get:
 *     summary: Get current fact
 *     description: Retrieve the current (most recent) fact for a subject-predicate pair
 *     tags: [Temporal]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: subject
 *         required: true
 *         schema:
 *           type: string
 *         description: Fact subject
 *       - in: query
 *         name: predicate
 *         required: true
 *         schema:
 *           type: string
 *         description: Fact predicate
 *     responses:
 *       200:
 *         description: Current fact for the subject-predicate pair
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TemporalFact'
 *       404:
 *         description: No current fact found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /api/temporal/subject/{subject}:
 *   get:
 *     summary: Get facts by subject
 *     description: Retrieve all facts for a specific subject
 *     tags: [Temporal]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: subject
 *         required: true
 *         schema:
 *           type: string
 *         description: Subject identifier
 *       - in: query
 *         name: at
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Query facts valid at specific time
 *       - in: query
 *         name: include_historical
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Include historical (expired) facts
 *     responses:
 *       200:
 *         description: List of facts for the subject
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/TemporalFact'
 */

/**
 * @swagger
 * /api/compression/compress:
 *   post:
 *     summary: Compress content
 *     description: Apply semantic compression to reduce content while preserving meaning
 *     tags: [Compression]
 *     security:
 *       - bearerAuth: []
 *       - apiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [content]
 *             properties:
 *               content:
 *                 type: string
 *                 description: Content to compress
 *               algorithm:
 *                 type: string
 *                 enum: [semantic, syntactic, aggressive, auto]
 *                 default: auto
 *                 description: Compression algorithm
 *               target_ratio:
 *                 type: number
 *                 minimum: 0.1
 *                 maximum: 0.9
 *                 description: Target compression ratio
 *     responses:
 *       200:
 *         description: Compressed content
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 compressed_content:
 *                   type: string
 *                 original_length:
 *                   type: integer
 *                 compressed_length:
 *                   type: integer
 *                 compression_ratio:
 *                   type: number
 *                 algorithm_used:
 *                   type: string
 */

/**
 * @swagger
 * /sectors:
 *   get:
 *     summary: Get memory sectors
 *     description: Retrieve information about memory sector configuration
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Memory sector configuration
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sectors:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       config:
 *                         type: object
 */