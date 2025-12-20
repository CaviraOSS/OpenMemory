# Getting Started with OpenMemory

OpenMemory provides a drop-in, SQL-native long-term memory layer for your AI agents. It goes beyond simple vector storage by incorporating temporal graphs, user entity tracking, and advanced retrieval dynamics (Recency, Frequency, Importance).

## Installation

### Python
```bash
pip install openmemory
```

### Node.js
```bash
npm install openmemory-js
```

## Quick Start (Python)

```python
import asyncio
from openmemory.client import Memory

async def main():
    # 1. Initialize (uses local sqlite by default)
    mem = Memory()
    
    # 2. Add a memory
    await mem.add("I am a software engineer interested in AI.", user_id="user_123")
    
    # 3. Search related context
    context = await mem.search("What is my job?", user_id="user_123")
    print(context)
    # output: [{'content': 'I am a software engineer...', ...}]

if __name__ == "__main__":
    asyncio.run(main())
```

## Quick Start (Node.js)

```javascript
const { Memory } = require('openmemory-js');

async function main() {
    const mem = new Memory();
    await mem.add("I prefer coffee over tea.", { user_id: 'user_123' });
    
    const context = await mem.search("What do I drink?", { user_id: 'user_123' });
    console.log(context);
}

main();
```

## Configuration
OpenMemory defaults to `sqlite:///openmemory.db` in the current directory. You can configure this via environment variables:

- `OPENMEMORY_DB_URL`: Database connection string (e.g., `postgresql://...`)
- `OPENMEMORY_DEBUG`: Set to `true` for verbose logging.
