
import asyncio
# import streamlit as st
from openmemory.client import Memory

# ==================================================================================
# STREAMLIT DASHBOARD (Mock logic)
# ==================================================================================
# This file contains the LOCIG you would put in a Streamlit app.
# (Streamlit requires running via `streamlit run`, this script simulates the data fetch).
# ==================================================================================

async def get_memory_stats(uid: str):
    mem = Memory()
    
    # 1. Fetch recent history
    history = mem.history(user_id=uid, limit=100)
    
    # 2. Calculate Stats
    total_memories = len(history)
    avg_len = sum(len(h['content']) for h in history) / total_memories if total_memories else 0
    
    # 3. Tag Distribution
    tags_count = {}
    for h in history:
        tags = h.get('metadata', {}).get('tags', []) # assuming meta tags or top level
        # In this SDK version, tags might be in metadata dict
        if isinstance(tags, list):
            for t in tags:
                tags_count[t] = tags_count.get(t, 0) + 1
                
    return {
        "count": total_memories,
        "avg_length": avg_len,
        "tags": tags_count
    }

async def main():
    print("--- Streamlit Logic Demo ---")
    data = await get_memory_stats("user_demo")
    
    print(f"Total Memories: {data['count']}")
    print(f"Avg Content Length: {data['avg_length']:.1f} chars")
    print("Tag Distribution:")
    for t, c in data['tags'].items():
        print(f" - {t}: {c}")
    
    print("\n(To run real dashboard: `pip install streamlit` and wrap this in st.write calls)")

if __name__ == "__main__":
    asyncio.run(main())
