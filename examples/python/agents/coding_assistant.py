
import asyncio
from openmemory.client import Memory

# ==================================================================================
# CODING ASSISTANT
# ==================================================================================
# Stores code snippets and solutions.
# Useful for "Remember how I fixed X" scenarios.
# ==================================================================================

class CodeMind:
    def __init__(self):
        self.mem = Memory()
        self.uid = "dev_user"

    async def store_solution(self, problem: str, code: str, language: str):
        content = f"SOLUTION for '{problem}':\n```{language}\n{code}\n```"
        await self.mem.add(content, user_id=self.uid, meta={"lang": language, "type": "snippet"}, tags=["code", language])
        print(f"Stored solution for: {problem}")

    async def search_solution(self, query: str):
        print(f"Searching for code: {query}...")
        results = await self.mem.search(query, user_id=self.uid, limit=1)
        if results:
            print("\n--- FOUND SNIPPET ---")
            print(results[0]['content'])
            print("---------------------")
        else:
            print("No snippets found.")

async def main():
    bot = CodeMind()
    
    # User teaches the bot a specific pattern
    await bot.store_solution(
        "Pandas datetime conversion", 
        "df['date'] = pd.to_datetime(df['date'], format='%Y-%m-%d')", 
        "python"
    )
    
    # Later, asks for it
    await bot.search_solution("how to convert pandas dates")

if __name__ == "__main__":
    asyncio.run(main())
