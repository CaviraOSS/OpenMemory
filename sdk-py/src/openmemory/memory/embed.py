try:
    import numpy as np
except ImportError:
    np = None
import struct
from openmemory.core.cfg import env
try:
    import openai
except ImportError:
    openai = None
import time
import random

def vector_to_buffer(vec):
    # Convert numpy array or list to bytes (float32)
    if np and isinstance(vec, np.ndarray):
        return vec.tobytes()
    # Fallback for list
    return struct.pack(f'{len(vec)}f', *vec)

def buffer_to_vector(buf):
    # Convert bytes to numpy array
    if np:
        return np.frombuffer(buf, dtype=np.float32)
    # Fallback
    count = len(buf) // 4
    return list(struct.unpack(f'{count}f', buf))

async def embed_multi_sector(id, content, sectors, chunks=None):
    # For now, synchronous implementation or simple async wrapper
    # Python's async/await is different, but we can make this async
    
    provider = env["emb_kind"]
    embeddings = []

    if provider == "synthetic":
        # Simple deterministic embedding based on content hash/length for testing
        dim = env["vec_dim"] or 384 # Default for smart tier
        if env["tier"] == "fast": dim = 256
        if env["tier"] == "deep": dim = 1536
        
        # Create a pseudo-random vector based on content
        seed = sum(ord(c) for c in content[:100])
        if np:
            np.random.seed(seed)
            vec = np.random.rand(dim).astype(np.float32)
            # Normalize
            vec = vec / np.linalg.norm(vec)
        else:
            random.seed(seed)
            vec = [random.random() for _ in range(dim)]
            # Normalize
            norm = sum(x*x for x in vec) ** 0.5
            vec = [x/norm for x in vec]
        
        for sector in sectors:
            embeddings.append({
                "sector": sector,
                "vector": vec,
                "dim": dim
            })
            
    elif provider == "openai":
        client = openai.OpenAI(api_key=env["openai_key"])
        model = env["openai_model"] or "text-embedding-3-small"
        
        # Simple mode: one embedding for all
        res = client.embeddings.create(input=content, model=model)
        vec = np.array(res.data[0].embedding, dtype=np.float32)
        dim = len(vec)
        
        for sector in sectors:
            embeddings.append({
                "sector": sector,
                "vector": vec,
                "dim": dim
            })
            
    # Add other providers as needed
    
    return embeddings

