
import asyncio
import time
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from openmemory.client import Memory

# ==================================================================================
# AGENT MEMORY CORE
# ==================================================================================
# A production-ready drop-in module for AI Agents.
# 
# Features:
# - Automatic Metadata Extraction (Time, Type)
# - Dual-Mode Recall: Semantic Search + Recent Short-Term History
# - "Thought" Storage: Store internal agent monologues separately from user chat
# - Entity Tracking: Dedicated methods to store facts about users/world
# ==================================================================================

@dataclass
class AgentContext:
    user_id: str
    session_id: str = "default"
    platform: str = "cli"

class AgentMemoryCore:
    def __init__(self, memory_client: Memory = None):
        self.mem = memory_client or Memory()
    
    async def add_interaction(self, ctx: AgentContext, role: str, content: str, tags: List[str] = None):
        """
        Log a chat interaction (User message or Agent response).
        """
        meta = {
            "type": "interaction",
            "role": role,
            "session_id": ctx.session_id,
            "platform": ctx.platform,
            "timestamp": time.time()
        }
        t = tags or []
        t.append(f"role:{role}")
        t.append("interaction")
        
        await self.mem.add(content, user_id=ctx.user_id, meta=meta, tags=t)

    async def add_thought(self, ctx: AgentContext, thought: str):
        """
        Log an internal thought/reasoning trace (invisible to user usually, but useful for context).
        """
        meta = {
            "type": "thought",
            "session_id": ctx.session_id,
            "validity": "ephemeral" # Hint that this might decay faster if we had decay logic for it
        }
        await self.mem.add(thought, user_id=ctx.user_id, meta=meta, tags=["thought", "internal"])

    async def save_fact(self, ctx: AgentContext, subject: str, predicate: str, object_: str):
        """
        Store a structured fact (e.g., 'User likes Pizza').
        Uses a standardized format for better retrieval.
        """
        content = f"{subject} {predicate} {object_}"
        meta = {
            "type": "fact",
            "subject": subject,
            "predicate": predicate,
            "object": object_,
            "confidence": 1.0
        }
        await self.mem.add(content, user_id=ctx.user_id, meta=meta, tags=["fact", "knowledge"])

    async def recall_context(self, ctx: AgentContext, query: str, limit: int = 5) -> List[str]:
        """
        Hybrid Recall:
        1. Fetches recent short-term history (last 3 items) for immediate coherence.
        2. Performs semantic search for relevant long-term memories.
        3. Deduplicates and merges.
        """
        # 1. Short-term history (raw retrieval)
        recent_items = self.mem.history(user_id=ctx.user_id, limit=3)
        recent_ids = {r['id'] for r in recent_items}
        
        # 2. Long-term semantic search
        semantic_hits = await self.mem.search(query, user_id=ctx.user_id, limit=limit)
        
        # 3. Merge
        # We value semantic hits, but exclude if they are already in the immediate history window
        # to avoid redundancy in the prompt.
        context_lines = []
        
        # Add Semantic Hits first (Historical Context)
        for hit in semantic_hits:
            if hit['id'] not in recent_ids:
                # Format: "[Memory] content"
                context_lines.append(f"[Relevant Memory] {hit['content']}")
        
        # Add Recent History (Immediate Context) - Reversed to be chronological if history returns newest first
        # Assuming history returns [newest, ..., oldest]
        for item in reversed(recent_items):
            role = item.get('metadata', {}).get('role', 'unknown')
            context_lines.append(f"[{role}] {item['content']}")
            
        return context_lines

# ==================================================================================
# EXAMPLE USAGE
# ==================================================================================

async def run_demo():
    print("Initializing Agent Memory Core...")
    core = AgentMemoryCore()
    ctx = AgentContext(user_id="user_99", session_id="session_alpha")
    
    # 1. Simulate previous knowledge
    print("-> Learning facts...")
    await core.save_fact(ctx, "User", "is working on", "Project Apollo")
    await core.save_fact(ctx, "Project Apollo", "deadline is", "next Friday")
    
    # 2. Simulate conversation
    print("-> Processing conversation...")
    await core.add_interaction(ctx, "user", "What should I focus on today?")
    await core.add_thought(ctx, "The user is stressed. I should prioritize deadlines.")
    
    # 3. Recall
    print("-> Agent Recalling Context for response generation...")
    context = await core.recall_context(ctx, "focus priorities deadline")
    
    print("\n--- CONSTRUCTED PROMPT CONTEXT ---")
    for line in context:
        print(line)
    print("----------------------------------")

if __name__ == "__main__":
    asyncio.run(run_demo())
