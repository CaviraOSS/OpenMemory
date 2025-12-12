import uuid
import time
import json
try:
    import requests
except ImportError:
    requests = None
import asyncio
from openmemory.core.cfg import configure, env
from openmemory.core import db as core_db
from openmemory.core.db import init_db, q
from openmemory.memory.hsg import classify_content, sector_configs, create_cross_sector_waypoints, calc_mean_vec, create_single_waypoint, hsg_query, reinforce_memory
from openmemory.memory.embed import embed_multi_sector, buffer_to_vector, vector_to_buffer
from openmemory.utils.chunking import chunk_text
from openmemory.ops.ingest import ingest_document, ingest_url as ops_ingest_url
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
                if provider == "ollama": config_update["ollama_model"] = embeddings["model"]

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
            # q.ins_vec.run(id, emb["sector"], userId, vec_buf, emb["dim"])
            await core_db.vector_store.store_vector(id, emb["sector"], emb["vector"], emb["dim"], userId)

        # Waypoints logic...
        
        return {"id": id, "primarySector": primary_sector, "sectors": sectors}

    def query(self, query, k=10, filters=None, userId=None):
        return asyncio.run(self._query_async(query, k, filters, userId))

    async def _query_async(self, query, k=10, filters=None, userId=None):
        if self.mode == "remote":
            return self._remote_query(query, k, filters, userId)
        
        # Merge userId into filters if not already present
        if filters is None:
            filters = {}
        if userId and "user_id" not in filters:
            filters["user_id"] = userId

        return await hsg_query(query, k, filters)

    def delete(self, id):
        return asyncio.run(self._delete_async(id))

    async def _delete_async(self, id):
        if self.mode == "remote":
            return self._remote_delete(id)
        
        q.del_mem.run(id)
        # q.del_vec.run(id)
        await core_db.vector_store.delete_vectors(id)
        q.del_waypoints.run(id, id)

    def getAll(self, limit=100, offset=0, sector=None, userId=None):
        return asyncio.run(self._get_all_async(limit, offset, sector, userId))

    async def _get_all_async(self, limit=100, offset=0, sector=None, userId=None):
        if self.mode == "remote":
            return self._remote_get_all(limit, offset, sector, userId)
        
        if userId:
            return q.all_mem_by_user.all(userId, limit, offset)
        if sector:
            return q.all_mem_by_sector.all(sector, limit, offset)
        return q.all_mem.all(limit, offset)

    def get_user_summary(self, user_id):
        return asyncio.run(self._get_user_summary_async(user_id))
    
    async def _get_user_summary_async(self, user_id):
        if self.mode == "remote":
            return self._remote_get_user_summary(user_id)
        
        user = q.get_user.get(user_id)
        if not user: return None
        return {
            "user_id": user["user_id"],
            "summary": user["summary"],
            "reflection_count": user["reflection_count"],
            "updated_at": user["updated_at"]
        }

    def reinforce(self, id, boost=0.1):
        return asyncio.run(self._reinforce_async(id, boost))
    
    async def _reinforce_async(self, id, boost):
        if self.mode == "remote":
            return self._remote_reinforce(id, boost)
        
        await reinforce_memory(id, boost)

    def ingest(self, content, contentType="text/plain", metadata=None, userId=None, config=None):
        return asyncio.run(self._ingest_async(content, contentType, metadata, userId, config))

    async def _ingest_async(self, content, contentType, metadata, userId, config):
        if self.mode == "remote":
            return self._remote_ingest(content, contentType, metadata, userId, config)
        
        return await ingest_document(content, content, {**(metadata or {}), "content_type": contentType}, config, userId)

    def ingest_url(self, url, metadata=None, userId=None, config=None):
        return asyncio.run(self._ingest_url_async(url, metadata, userId, config))
    
    async def _ingest_url_async(self, url, metadata, userId, config):
        if self.mode == "remote":
            return self._remote_ingest_url(url, metadata, userId, config)
        
        return await ops_ingest_url(url, metadata, config, userId)

    def delete_user_memories(self, user_id):
        return asyncio.run(self._delete_user_memories_async(user_id))
    
    async def _delete_user_memories_async(self, user_id):
        if self.mode == "remote":
            return self._remote_delete_user_memories(user_id)
        
        mems = q.all_mem_by_user.all(user_id, 10000, 0)
        deleted = 0
        for m in mems:
            q.del_mem.run(m["id"])
            q.del_vec.run(m["id"])
            q.del_waypoints.run(m["id"], m["id"])
            deleted += 1
        return deleted

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

    def _remote_query(self, query, k, filters, userId):
        payload = {"query": query, "k": k, "filters": filters}
        if userId: payload["user_id"] = userId
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

    def _remote_get_all(self, limit, offset, sector, userId):
        params = {"limit": limit, "offset": offset}
        if sector: params["sector"] = sector
        if userId: params["user_id"] = userId
        headers = {}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        
        res = requests.get(f"{self.url}/memory/all", params=params, headers=headers)
        res.raise_for_status()
        return res.json()

    def _remote_get_user_summary(self, user_id):
        headers = {}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        res = requests.get(f"{self.url}/users/{user_id}/summary", headers=headers)
        if res.status_code == 404: return None
        res.raise_for_status()
        return res.json()

    def _remote_reinforce(self, id, boost):
        payload = {"id": id, "boost": boost}
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        requests.post(f"{self.url}/memory/reinforce", json=payload, headers=headers).raise_for_status()

    def _remote_ingest(self, content, contentType, metadata, userId, config):
        payload = {
            "data": content, # Assuming text or properly encoded
            "content_type": contentType,
            "metadata": metadata,
            "user_id": userId,
            "config": config
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        res = requests.post(f"{self.url}/memory/ingest", json=payload, headers=headers)
        res.raise_for_status()
        return res.json()

    def _remote_ingest_url(self, url, metadata, userId, config):
        payload = {
            "url": url,
            "metadata": metadata,
            "user_id": userId,
            "config": config
        }
        headers = {"Content-Type": "application/json"}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        res = requests.post(f"{self.url}/memory/ingest/url", json=payload, headers=headers)
        res.raise_for_status()
        return res.json()

    def _remote_delete_user_memories(self, user_id):
        headers = {}
        if self.api_key: headers["Authorization"] = f"Bearer {self.api_key}"
        res = requests.delete(f"{self.url}/users/{user_id}/memories", headers=headers)
        res.raise_for_status()
        return res.json().get("deleted", 0)
