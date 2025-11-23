try:
    import numpy as np
except ImportError:
    np = None
from openmemory.core.db import q
from openmemory.memory.embed import embed_multi_sector, buffer_to_vector, vector_to_buffer

sector_configs = {
    "episodic": {"decay_lambda": 0.005},
    "semantic": {"decay_lambda": 0.001},
    "procedural": {"decay_lambda": 0.002},
    "emotional": {"decay_lambda": 0.01},
    "reflective": {"decay_lambda": 0.001}
}

def classify_content(content, metadata=None):
    # Simple keyword-based classification for now, mirroring JS logic if it was simple
    # or just defaulting to episodic/semantic
    content_lower = content.lower()
    primary = "episodic"
    additional = []

    if "how to" in content_lower or "step" in content_lower:
        primary = "procedural"
    elif "feel" in content_lower or "happy" in content_lower or "sad" in content_lower:
        primary = "emotional"
    elif "define" in content_lower or "what is" in content_lower:
        primary = "semantic"
    
    # Add others based on tags if present in metadata
    if metadata and "tags" in metadata:
        tags = metadata["tags"]
        if "learning" in tags: additional.append("semantic")
        if "emotion" in tags: additional.append("emotional")
    
    return {
        "primary": primary,
        "additional": list(set(additional))
    }

def calc_mean_vec(embeddings, sectors):
    if not embeddings:
        return np.array([]) if np else []
    
    vecs = [e["vector"] for e in embeddings]
    if not vecs:
        return np.array([]) if np else []
        
    if np:
        # Simple mean
        mean = np.mean(vecs, axis=0)
        # Normalize
        norm = np.linalg.norm(mean)
        if norm > 0:
            mean = mean / norm
        return mean.astype(np.float32)
    else:
        # Pure python mean
        dim = len(vecs[0])
        mean = [0.0] * dim
        for v in vecs:
            for i in range(dim):
                mean[i] += v[i]
        
        count = len(vecs)
        mean = [x/count for x in mean]
        
        # Normalize
        norm = sum(x*x for x in mean) ** 0.5
        if norm > 0:
            mean = [x/norm for x in mean]
        return mean

async def create_single_waypoint(id, mean_vec, now, user_id):
    # In a real implementation, this would find nearest neighbors and create edges
    # For now, just a placeholder or minimal implementation
    pass

async def create_cross_sector_waypoints(id, primary, additional, user_id):
    pass

async def hsg_query(query, k=10, filters=None):
    # 1. Embed query
    # For now, just use synthetic or openai based on config
    # We need a way to get query embedding. 
    # Re-use embed_multi_sector but just take the first vector
    
    embeddings = await embed_multi_sector("query", query, ["query"])
    if not embeddings:
        return []
    
    query_vec = embeddings[0]["vector"]
    
    # 2. Fetch all memories (naive scan for now, or use vector search if DB supported it)
    # Since we use SQLite without vector extension in this basic port, we have to do linear scan
    # or rely on the JS implementation's logic. JS implementation uses `sqlite-vec` or manual cosine sim?
    # The JS `db.ts` showed `v blob`. It didn't show vector search queries. 
    # Wait, `get_vecs_by_sector` returns all vectors.
    
    # Naive implementation: fetch all vectors, compute cosine sim, sort
    # This is slow but functional for local mode with small data
    
    # TODO: Optimize with vector index
    
    all_memories = q.all_mem.all(1000, 0) # Limit to 1000 for now
    
    results = []
    for mem in all_memories:
        if not mem["mean_vec"]: continue
        
        vec = buffer_to_vector(mem["mean_vec"])
        if len(vec) != len(query_vec): continue
        
        # Cosine similarity
        if np:
            score = np.dot(vec, query_vec)
        else:
            score = sum(a*b for a,b in zip(vec, query_vec))
        
        results.append({
            **mem,
            "score": float(score)
        })
        
    # Sort by score
    results.sort(key=lambda x: x["score"], reverse=True)
    return results[:k]
