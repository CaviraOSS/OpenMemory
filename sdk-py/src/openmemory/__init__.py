import uuid
import time
import json
try:
    import requests
except ImportError:
    requests = None
import asyncio
from openmemory.core.cfg import configure, env
from openmemory.core.db import init_db, q
from openmemory.memory.hsg import classify_content, sector_configs, create_cross_sector_waypoints, calc_mean_vec, create_single_waypoint, hsg_query
from openmemory.memory.embed import embed_multi_sector, buffer_to_vector, vector_to_buffer
from openmemory.utils.chunking import chunk_text

class OpenMemory:
    def __init__(self, mode="local", path=None, url=None, apiKey=None, tier=None, embeddings=None, compression=None, decay=None, reflection=None, vectorStore=None, langGraph=None):
        self.mode = mode
        self.url = url
        self.api_key = apiKey

        if self.mode == "remote":
            if not self.url:
                raise ValueError("Remote mode requires url parameter")
        else:
            # Local mode configuration
            if not path:
                raise ValueError('Local mode requires "path" configuration (e.g., "./data/memory.sqlite").')
            if not tier:
                raise ValueError('Local mode requires "tier" configuration (e.g., "fast", "smart", "deep", "hybrid").')
            if not embeddings:
                raise ValueError('Local mode requires "embeddings" configuration. Please specify a provider (e.g., openai, ollama, synthetic).')

            provider = embeddings.get("provider")
            emb_api_key = embeddings.get("apiKey")
            aws_config = embeddings.get("aws")

            if provider in ["openai", "gemini"] and not emb_api_key:
                raise ValueError(f"API key is required for {provider} embeddings.")
            
            if provider == "aws" and (not aws_config or not aws_config.get("accessKeyId") or not aws_config.get("secretAccessKey")):
                raise ValueError("AWS credentials (accessKeyId, secretAccessKey) are required for AWS embeddings.")

            config_update = {}
            config_update["db_path"] = path
            config_update["tier"] = tier
            
            config_update["emb_kind"] = provider
            if embeddings.get("mode"): config_update["embed_mode"] = embeddings["mode"]
            if embeddings.get("dimensions"): config_update["vec_dim"] = embeddings["dimensions"]

            if emb_api_key:
                if provider == "openai": config_update["openai_key"] = emb_api_key
                if provider == "gemini": config_update["gemini_key"] = emb_api_key
            
            if embeddings.get("model"):
                if provider == "openai": config_update["openai_model"] = embeddings["model"]

            if aws_config:
                config_update["AWS_ACCESS_KEY_ID"] = aws_config.get("accessKeyId")
                config_update["AWS_SECRET_ACCESS_KEY"] = aws_config.get("secretAccessKey")
                config_update["AWS_REGION"] = aws_config.get("region")
            
            if embeddings.get("ollama") and embeddings["ollama"].get("url"):
                config_update["ollama_url"] = embeddings["ollama"]["url"]
            
            if embeddings.get("localPath"):
                config_update["local_model_path"] = embeddings["localPath"]

            # ... map other options ...
            
            configure(config_update)
            init_db(path)

    def add(self, content, tags=None, metadata=None, userId=None, salience=None, decayLambda=None):
        # Wrapper to run async add in sync context if needed, or just use async
        # For simplicity in this port, I'll make it synchronous blocking by running the loop
        # ideally users should use async, but for SDK parity with simple usage:
        return asyncio.run(self._add_async(content, tags, metadata, userId, salience, decayLambda))

    async def _add_async(self, content, tags=None, metadata=None, userId=None, salience=None, decayLambda=None):
        if self.mode == "remote":
            return self._remote_add(content, tags, metadata, userId, salience, decayLambda)

        id = str(uuid.uuid4())
        now = int(time.time() * 1000)

        classification = classify_content(content, metadata)
        primary_sector = classification["primary"]
        sectors = [primary_sector] + classification["additional"]

        chunks = chunk_text(content) if len(content) > 3000 else None
        embeddings = await embed_multi_sector(id, content, sectors, chunks)
        mean_vec = calc_mean_vec(embeddings, sectors)
        mean_buf = vector_to_buffer(mean_vec)

        tags_json = json.dumps(tags) if tags else None
        meta_json = json.dumps(metadata) if metadata else None
        salience = salience if salience is not None else 0.5
        decay_lambda = decayLambda if decayLambda is not None else sector_configs.get(primary_sector, {}).get("decay_lambda", 0.001)

        q.ins_mem.run(
            id, userId, 0, content, None, primary_sector,
            tags_json, meta_json, now, now, now, salience, decay_lambda, 1,
            len(mean_vec), mean_buf, None, 0
        )

        for emb in embeddings:
            vec_buf = vector_to_buffer(emb["vector"])
            q.ins_vec.run(id, emb["sector"], userId, vec_buf, emb["dim"])

        # Waypoints logic...
        
        return {"id": id, "primarySector": primary_sector, "sectors": sectors}

    def query(self, query, k=10, filters=None):
        return asyncio.run(self._query_async(query, k, filters))

    async def _query_async(self, query, k=10, filters=None):
        if self.mode == "remote":
            return self._remote_query(query, k, filters)
        
        return await hsg_query(query, k, filters)

    def delete(self, id):
        return asyncio.run(self._delete_async(id))

    async def _delete_async(self, id):
        if self.mode == "remote":
            return self._remote_delete(id)
        
        q.del_mem.run(id)
        q.del_vec.run(id)
        q.del_waypoints.run(id, id)

    def getAll(self, limit=100, offset=0, sector=None):
        return asyncio.run(self._get_all_async(limit, offset, sector))

    async def _get_all_async(self, limit=100, offset=0, sector=None):
        if self.mode == "remote":
            return self._remote_get_all(limit, offset, sector)
        
        if sector:
            return q.all_mem_by_sector.all(sector, limit, offset)
        return q.all_mem.all(limit, offset)

    def close(self):
        from openmemory.core.db import close_db
        close_db()

    # Remote methods
    def _remote_add(self, content, tags, metadata, userId, salience, decayLambda):
        payload = {
            "content": content,
            "tags": tags,
            "metadata": metadata,
            "user_id": userId,
            "salience": salience,
            "decay_lambda": decayLambda
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        
        res = requests.post(f"{self.url}/memory/add", json=payload, headers=headers)
        res.raise_for_status()
        return res.json()

    def _remote_query(self, query, k, filters):
        payload = {"query": query, "k": k, "filters": filters}
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        
        res = requests.post(f"{self.url}/memory/query", json=payload, headers=headers)
        res.raise_for_status()
        return res.json()

    def _remote_delete(self, id):
        headers = {}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        res = requests.delete(f"{self.url}/memory/{id}", headers=headers)
        res.raise_for_status()

    def _remote_get_all(self, limit, offset, sector):
        params = {"limit": limit, "offset": offset}
        if sector: params["sector"] = sector
        headers = {}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        
        res = requests.get(f"{self.url}/memory/all", params=params, headers=headers)
        res.raise_for_status()
        return res.json()
