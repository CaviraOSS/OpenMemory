# WB Repricer System — project-specific memory integration

The WB Repricer System gets its own OpenMemory instance so every agent, IDE, test run, and CI pipeline has a private, project-scoped memory. Follow the three phases below.

## 1. Start the project backend

1. Copy `.env.project.example` to `.env.project.wb-repricer`.
2. Choose a unique port (e.g. `18090`) and a strong API key:

   ```bash
   OM_PORT=18090
   OM_API_KEY=$(openssl rand -base64 32)
   ```

3. Double-check the other values (`OM_METADATA_BACKEND=sqlite`, `OM_DB_PATH=/data/openmemory.sqlite`, etc.) so the DB lives inside the project container.
4. Run the project-specific instance:

   ```bash
   docker compose \
     --project-name om_wb-repricer \
     --env-file .env.project.wb-repricer \
     up -d --build openmemory
   ```

5. Validate with `curl http://localhost:18090/health` and stop with:

   ```bash
   docker compose --project-name om_wb-repricer down
   ```


## 2. Wire the WB Repricer repo (backend + CI)

Every process that should share the WB Repricer memory needs three settings:

  - `OPENMEMORY_URL=http://localhost:18090`
  - `OPENMEMORY_API_KEY=<the same key you generated>`
  - `OPENMEMORY_USER_ID=<actor identity>` (e.g. `repricer-ci`, `repricer-backend`, `repricer-logger`)

Place them inside the repo’s env/config (e.g. `.env.memory`, `.github/workflows/memory.env`, or a secrets manager). Example `.env.memory`:

```dotenv
OPENMEMORY_URL=http://localhost:18090
OPENMEMORY_API_KEY=REPLACE_WITH_YOUR_SECRET
WB_REPRICER_MEMORY_USER=repricer-backend
```

Use that env file any time you start the service or run agents. For example:

```bash
source .env.memory
OPENMEMORY_USER_ID=${WB_REPRICER_MEMORY_USER} python app.py
```


## 3. Instructions for “Е агент” (E agents developer)

1. **Clone + configure the repo**  
   - Use the `.env.memory` template above (or add the vars to your service manifest).  
   - Make sure `OPENMEMORY_URL`/`OM_PORT` point to the project instance (`18090`).  
   - Pass `OPENMEMORY_API_KEY` and a human-readable `OPENMEMORY_USER_ID` (`agent-core`, `e-agent`, etc.).

2. **Adapt the code**  
   - For **Python** services or agents:

     ```python
     import os
     from openmemory.client import Memory

     mem = Memory()
     mem.add(
         "Agent noted repricer tweak",
         user_id=os.environ.get("OPENMEMORY_USER_ID"),
         metadata={
             "project": "WB Repricer System",
             "repo": "repricer",
             "branch": os.getenv("GIT_BRANCH"),
             "source": "agent-core",
         },
     )
     ```

   - For **Node/JS** services:

     ```ts
     import { Memory } from "openmemory-js";

     const mem = new Memory();
     await mem.add("Adjusted repricer rates", {
       user_id: process.env.OPENMEMORY_USER_ID,
       metadata: { project: "WB Repricer System", source: "e-agent" },
     });
     ```

3. **Hook IDE + MCP tools**
   - Set the VS Code extension to `http://localhost:18090` and the same API key.
   - When the agent starts, it sends IDE events with `user_id` scoped to WB Repricer (the extension now generates one per workspace/ project name).
   - For MCP clients (Claude/Cursor/Codex), update their config to `http://localhost:18090/mcp` and supply the API key in `x-api-key`.

4. **Working with multiple agents/projects**  
   - Each agent uses `user_id` to identify its persona (`repricer-analyst`, `repricer-ci`, `repricer-agent`).  
   - Add `metadata.project` and `metadata.source` so queries can filter results per tool/branch.
   - When the project is done, clean up via `docker compose --project-name om_wb-repricer down` (keeps memory isolated from other work).

## 4. Troubleshooting

- If you see `401`/`authentication_required`, confirm the API key (`x-api-key`) matches `.env.project.wb-repricer`.
- If duplicate ports clash, bump `OM_PORT` and update `OPENMEMORY_URL` accordingly (e.g. `http://localhost:18091`).
- When switching between projects, point each IDE/agent at the matching `backendUrl` and `user_id` to avoid leaking context.

More general patterns are documented in `README.md` and `docs/multi-project.md`. Use this page as your “WB Repricer System” potion.
