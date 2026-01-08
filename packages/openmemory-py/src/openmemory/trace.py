from typing import List, Dict, Any
from .main import Memory

class Tracer:
    def __init__(self, mem: "Memory"):
        self.mem = mem

    async def trace(self, query: str, user_id: str = None) -> Dict[str, Any]:
        """
        Explainable retrieval.
        """
        results = await self.mem.search(query, user_id=user_id, debug=True)

        explanation = []
        for r in results:
            debug = r.get("_debug", {})
            explanation.append({
                "id": r["id"],
                "content_preview": r["content"][:50],
                "score_breakdown": debug
            })

        return {
            "query": query,
            "user_id": user_id,
            "results": explanation
        }
