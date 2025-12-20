
import asyncio
from openmemory.client import Memory

# ==================================================================================
# DOCUMENT HIERARCHY
# ==================================================================================
# Managing Parent-Child relationships.
# - File (Parent)
#   - Chunk 1 (Child)
#   - Chunk 2 (Child)
#
# When a chunk is found, we might want to fetch the Parent title or sibling chunks.
# ==================================================================================

async def index_document(mem: Memory, uid: str, doc_id: str, title: str, chunks: list):
    # Store Parent (Simulated as a meta-memory or just metadata on chunks)
    # Here we tag chunks with doc_id
    for i, chunk in enumerate(chunks):
        await mem.add(chunk, user_id=uid, meta={
            "doc_id": doc_id,
            "doc_title": title,
            "chunk_index": i,
            "total_chunks": len(chunks)
        })

async def main():
    mem = Memory()
    uid = "doc_user"
    
    book_text = [
        "Chapter 1: The beginning. It was a dark night.",
        "Chapter 2: The middle. Something happened.",
        "Chapter 3: The end. They lived happily."
    ]
    
    await index_document(mem, uid, "book_1", "The Story", book_text)
    
    # Search finds a chunk
    hits = await mem.search("dark night", user_id=uid, limit=1)
    if hits:
        hit = hits[0]
        meta = hit['metadata']
        print(f"Found match in: {meta['doc_title']}")
        print(f"Excerpt: {hit['content']}")
        
        # Expand Context: Fetch neighbors?
        # In a real app, query by doc_id and chunk_index +/- 1
        # OpenMemory doesn't have SQL-like 'WHERE chunk_index=X', so we'd fetch all for doc and sort client side
        # or rely on the fact that they were ingested sequentially and might return sequentially in history (if time close).
        print("(Application would now fetch full document context using doc_id)")

if __name__ == "__main__":
    asyncio.run(main())
