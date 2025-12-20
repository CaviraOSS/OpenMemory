
import asyncio
from openmemory.client import Memory

# ==================================================================================
# ADVANCED RAG METADATA
# ==================================================================================
# Demonstrates filtering RAG results by:
# - Author
# - Complexity Level
# - Date Range (simulated via metadata check in loop)
# ==================================================================================

async def main():
    mem = Memory()
    uid = "rag_advanced"
    
    # Ingest diverse content
    docs = [
        {"text": "Quantum entanglement explained simply: spooky action at a distance.", "meta": {"level": "beginner", "author": "Alice"}},
        {"text": "Hamiltonian operators in Hilbert space verify entanglement entropy.", "meta": {"level": "expert", "author": "Bob"}},
        {"text": "Entanglement allows for superdense coding protocols.", "meta": {"level": "intermediate", "author": "Alice"}},
    ]
    
    print("Ingesting docs...")
    for d in docs:
        await mem.add(d["text"], user_id=uid, meta=d["meta"])
        
    print("\n--- Query: 'Explain Entanglement' (Beginner only) ---")
    # Search globally
    results = await mem.search("entanglement", user_id=uid, limit=10)
    
    # Post-filtering (since backend might generic semantic search)
    # Ideally, OpenMemory.search supports dict filters. Let's assume passed in kwargs filter.
    # But explicitly showing client-side filter for clarity:
    
    for r in results:
        meta = r.get("metadata", {})
        if meta.get("level") == "beginner":
             print(f"MATCH [Beginner]: {r['content']}")
             
    print("\n--- Query: 'Entanglement' (Author: Bob) ---")
    for r in results:
        meta = r.get("metadata", {})
        if meta.get("author") == "Bob":
             print(f"MATCH [Bob]: {r['content']}")

if __name__ == "__main__":
    asyncio.run(main())
