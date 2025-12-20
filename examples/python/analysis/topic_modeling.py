
import asyncio
from openmemory.client import Memory

# ==================================================================================
# TOPIC MODELING (NAIVE)
# ==================================================================================
# Clustering memories to find dominant themes.
# Uses Semantic Search results as "Clusters".
# ==================================================================================

async def find_themes(mem: Memory, uid: str):
    # Retrieve a broad set of memories
    history = mem.history(user_id=uid, limit=50)
    texts = [h['content'] for h in history]
    
    if not texts:
        print("No data.")
        return

    # In a real app: Use Scikit-Learn KMeans on embeddings.
    # Here: We simulate "Theme Discovery" by querying for generic concepts
    # and counting overlap.
    
    themes = ["technology", "personal", "finance"]
    print("Scanning for themes...")
    
    for theme in themes:
        hits = await mem.search(theme, user_id=uid, limit=10)
        # Filter for quality
        count = len([h for h in hits if h.get('score', 0) > 0.75])
        print(f"Theme '{theme}': {count} strong matches.")

async def main():
    mem = Memory()
    uid = "user_polymath"
    
    await mem.add("I need to buy stocks.", user_id=uid)
    await mem.add("Python 3.12 is fast.", user_id=uid)
    await mem.add("My dog is cute.", user_id=uid)
    
    await find_themes(mem, uid)

if __name__ == "__main__":
    asyncio.run(main())
