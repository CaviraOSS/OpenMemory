
import asyncio
from openmemory.client import Memory

# ==================================================================================
# HYBRID SEARCH (Keyword + Semantic)
# ==================================================================================
# Simulates a hybrid search strategy.
# OpenMemory natively is Vector (Semantic).
# This script adds a minimal Keyword match scoring on top of the vector results
# to boost exact matches.
# ==================================================================================

def score_hybrid(hit, query_terms):
    # Vector Score
    v_score = hit.get('score', 0)
    
    # Keyword Score (Mock BM25-ish)
    content = hit['content'].lower()
    k_score = 0
    for term in query_terms:
        if term in content:
            k_score += 0.2
            
    # Weighted Sum
    final_score = (v_score * 0.7) + (k_score * 0.3)
    return final_score

async def main():
    mem = Memory()
    uid = "hybrid_user"
    
    await mem.add("The project code is named Project Falco.", user_id=uid)
    await mem.add("Falcons are fast birds of prey.", user_id=uid)
    
    query = "Project Falco"
    print(f"Query: {query}")
    
    # 1. Broad Vector Search
    hits = await mem.search(query, user_id=uid, limit=5)
    
    # 2. Re-rank with Hybrid logic
    terms = query.lower().split()
    ranked = []
    for h in hits:
        s = score_hybrid(h, terms)
        ranked.append((s, h))
    
    ranked.sort(key=lambda x: x[0], reverse=True)
    
    print("\nResults (Hybrid Ranked):")
    for score, h in ranked:
        print(f"[{score:.2f}] {h['content']}")

if __name__ == "__main__":
    asyncio.run(main())
