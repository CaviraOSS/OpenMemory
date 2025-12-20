
import asyncio
from openmemory.client import Memory

# ==================================================================================
# REFLECTION AGENT
# ==================================================================================
# An agent that critiques its own past actions.
# 1. Takes an action.
# 2. Stores the result.
# 3. Before next action, retrieves past critiques/reflections to improve.
# ==================================================================================

class ReflectionAgent:
    def __init__(self):
        self.mem = Memory()
        self.uid = "agent_reflection"
        
    async def act(self, task: str):
        print(f"\nTask: {task}")
        
        # 1. Recall past mistakes/lessons
        reflections = await self.mem.search(f"lessons learned about {task}", user_id=self.uid, limit=3)
        if reflections:
            print(" -> Recalled lessons:")
            for r in reflections:
                print(f"    - {r['content']}")
        
        # 2. Perform Action (Simulated)
        print(" -> Performing action...")
        result = "success" if "simple" in task else "failing edge case"
        print(f" -> Result: {result}")
        
        # 3. Reflect
        if result == "failing edge case":
            lesson = f"When attempting {task}, I failed because I didn't handle edge cases."
            print(f" -> Reflecting: {lesson}")
            await self.mem.add(lesson, user_id=self.uid, tags=["reflection", "lesson"])

async def main():
    agent = ReflectionAgent()
    
    # First attempt (will fail and learn)
    await agent.act("complex data migration")
    
    print("\n... some time later ...")
    
    # Second attempt (should recall lesson)
    await agent.act("complex data migration")

if __name__ == "__main__":
    asyncio.run(main())
