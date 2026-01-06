# API Server

OpenMemory exposes a REST API for language-agnostic integration.

**Base URL**: `http://localhost:18080` (default)

## Endpoints

### `POST /memory/add`

Add a new memory.

**Body:**
```json
{
  "content": "My cat's name is Luna",
  "user_id": "user_123",
  "tags": ["pet"]
}
```

### `POST /memory/query`

Search for memories.

**Body:**
```json
{
  "query": "What is the pet name?",
  "k": 3,
  "filters": { "user_id": "user_123" }
}
```

**Response:**
```json
{
  "matches": [
    {
      "id": "mem_abc123",
      "content": "My cat's name is Luna",
      "score": 0.89
    }
  ]
}
```

### `PATCH /memory/:id`

Update an existing memory. If `content` changes, embeddings are recomputed.

**Headers:**
- `x-api-key: <OM_API_KEY>` (required if auth is enabled)

**Body:**
```json
{
  "content": "Updated content (optional)",
  "tags": ["tag1", "tag2"],
  "metadata": { "source": "manual" },
  "user_id": "user_123"
}
```

### `DELETE /memory/:id`

Delete a memory by id (also removes vectors and waypoint links).

**Headers:**
- `x-api-key: <OM_API_KEY>` (required if auth is enabled)

**Example:**
```bash
curl -X DELETE "http://localhost:18080/memory/mem_abc123?user_id=user_123" \
  -H "x-api-key: <OM_API_KEY>"
```

### `GET /health`

Returns `200 OK` if the system is running.

## Running the Server

You can run the server using Docker or the Node CLI.

### Docker

```bash
docker run -e OM_PORT=18080 -p 18080:18080 openmemory/server
```

### CLI

```bash
opm serve --port 9000
```
