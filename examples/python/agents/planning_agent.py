
import asyncio
import json
from openmemory.client import Memory

# ==================================================================================
# PLANNING AGENT
# ==================================================================================
# Stores hierarchical plans.
# - High-level Goal
#   - Subtask 1
#   - Subtask 2
# Enables retrieving the current plan status across sessions.
# ==================================================================================

class PlanningAgent:
    def __init__(self):
        self.mem = Memory()
        self.uid = "agent_planner"

    async def create_plan(self, goal: str, steps: list):
        plan_doc = {
            "goal": goal,
            "steps": steps,
            "status": "active"
        }
        content = f"PLAN: {goal}\n" + "\n".join(f"- [ ] {s}" for s in steps)
        
        print(f"-> Creating plan for '{goal}'")
        await self.mem.add(content, user_id=self.uid, meta=plan_doc, tags=["plan"])

    async def get_current_plan(self, goal_query: str):
        # Find the specific plan
        hits = await self.mem.search(f"PLAN: {goal_query}", user_id=self.uid, limit=1)
        if hits:
            return hits[0]
        return None

    async def update_step(self, plan_memory_id: str, step_index: int, status: str):
        # In a real system, you'd fetch, update JSON, and re-save (or update metadata).
        # OpenMemory is append-heavy, but let's simulate a progress update log.
        print(f"-> Marking step {step_index} as {status}")
        await self.mem.add(f"UPDATE: Plan {plan_memory_id}, step {step_index} is now {status}", 
                           user_id=self.uid, 
                           tags=["plan_update"])

async def main():
    agent = PlanningAgent()
    await agent.create_plan("Build Rocket", ["Design Engine", "Fuel Test", "Launch"])
    
    plan = await agent.get_current_plan("Build Rocket")
    if plan:
        print(f"found plan: {plan['content']}")
        await agent.update_step(plan['id'], 0, "DONE")

if __name__ == "__main__":
    asyncio.run(main())
