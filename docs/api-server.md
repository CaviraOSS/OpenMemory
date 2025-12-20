# API Server

OpenMemory exposes a REST API for language-agnostic integration.

**Base URL**: `http://localhost:8080` (default)

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

### `POST /memory/search`

Search for memories.

**Body:**
```json
{
  "query": "What is the pet name?",
  "user_id": "user_123",
  "limit": 3
}
```

**Response:**
```json
{
  "memories": [
    {
      "id": "mem_abc123",
      "content": "My cat's name is Luna",
      "score": 0.89
    }
  ]
}
```

### `GET /health`

Returns `200 OK` if the system is running.

## Running the Server

You can run the server using Docker or the Node CLI.

### Docker

```bash
docker run -p 8080:8080 openmemory/server
```

### CLI

```bash
opm serve --port 9000
```
