# AI Agents System with OpenMemory Integration

Welcome to the **OpenMemory-Enhanced AI Agents Autonomous Development System**!

This system combines the power of autonomous AI development with persistent long-term memory, creating an unprecedented development environment where AI agents can work across multiple sessions with full context retention.

---

## 🎯 What Makes This Special?

### Traditional AI Agents System
- ✅ Autonomous development
- ✅ Project state tracking
- ❌ Memory resets between sessions
- ❌ Limited context window
- ❌ No semantic search

### OpenMemory-Enhanced System
- ✅ Autonomous development
- ✅ Project state tracking
- ✅ **Persistent memory across sessions**
- ✅ **Unlimited context retention**
- ✅ **Semantic search for patterns and decisions**
- ✅ **Natural memory decay** (less important things fade)
- ✅ **Cross-agent memory sharing**
- ✅ **Intelligent context retrieval**

---

## 🚀 Quick Start

### 1. Start OpenMemory Backend

```bash
cd backend
npm install
npm run dev
```

OpenMemory will start on `http://localhost:8080`

### 2. Verify Integration

```bash
cd .ai-agents
python3 openmemory_client.py
```

Should show: `✓ OpenMemory server is running`

### 3. Detect Project State

```bash
python3 detect-state.py
```

Will show either:
- `INITIALIZE` mode (fresh project - start from scratch)
- `RESUME` mode (existing project - continue where left off)

### 4. Start Development

If you're an AI agent reading this:

```python
# Import the client
from openmemory_client import OpenMemoryClient

# Connect to OpenMemory
client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory"
)

# Detect mode
mode = client.detect_mode()

if mode == "INITIALIZE":
    # Fresh start - read project requirements and begin
    pass
else:
    # Resume - load full context
    context = client.get_full_context()
    state = context['state']
    history = context['recent_actions']
    patterns = context['patterns']
    decisions = context['decisions']

# Start working and record everything
client.record_action(
    agent_name="your_agent_name",
    action="What you did",
    outcome="success"
)
```

---

## 📁 File Structure

```
.ai-agents/
├── README.md                          ← You are here
├── INTEGRATION_GUIDE.md               ← Detailed integration guide
├── START_HERE.md                      ← Original AI agents system guide
├── AI_AGENT_SYSTEM_INSTRUCTIONS.md    ← Template customization guide
├── SETUP_CHECKLIST.md                 ← Setup instructions
├── FILE_MANIFEST.md                   ← File overview
│
├── openmemory_client.py               ← 🆕 Python client library
├── detect-state.py                    ← 🔄 Updated with OpenMemory support
├── config.json                        ← 🆕 Integration configuration
│
├── COPY_AS_IS_AUTONOMOUS_MODE.md      ← Core autonomous rules
├── COPY_AS_IS_QUICK_START.md          ← Quick start guide
├── COPY_AS_IS_architect-commands.md   ← Command system
│
├── TEMPLATE_agent-roles.json          ← Agent definitions template
├── TEMPLATE_context-manager.json      ← Context system template
├── TEMPLATE_workflow-tracker.json     ← Workflow tracking template
├── TEMPLATE_project-state.json        ← State tracking template
└── TEMPLATE_README.md                 ← Project README template
```

### 🆕 New Files (OpenMemory Integration)

- **openmemory_client.py**: Python library for interacting with OpenMemory
- **INTEGRATION_GUIDE.md**: Comprehensive integration documentation
- **config.json**: Configuration for the unified system
- **detect-state.py** (updated): Now uses OpenMemory for state detection

---

## 💡 How It Works

### Memory Architecture

```
AI Agent Actions
       ↓
┌──────────────────────────────────┐
│   OpenMemory Client              │
│   (openmemory_client.py)         │
└───────────┬──────────────────────┘
            │
            ↓ HTTP REST API
┌───────────────────────────────────┐
│   OpenMemory Server               │
│   (localhost:8080)                │
│                                   │
│  ┌─────────────────────────────┐ │
│  │ Semantic Memory (States)    │ │
│  ├─────────────────────────────┤ │
│  │ Episodic Memory (Actions)   │ │
│  ├─────────────────────────────┤ │
│  │ Procedural Memory (Patterns)│ │
│  ├─────────────────────────────┤ │
│  │ Reflective Memory (Decisions)│ │
│  └─────────────────────────────┘ │
└───────────────────────────────────┘
            │
            ↓
   SQLite/PostgreSQL
```

### Development Flow

1. **AI Agent Starts**
   - Runs `detect-state.py`
   - Connects to OpenMemory
   - Checks if project exists

2. **INITIALIZE Mode (New Project)**
   - Agent reads project requirements
   - Creates initial structure
   - **Records all actions** in OpenMemory
   - **Stores patterns** as they're discovered
   - **Records decisions** with rationale
   - **Saves state** periodically

3. **RESUME Mode (Existing Project)**
   - Agent loads full context from OpenMemory
   - Reviews recent history
   - Checks patterns learned
   - Reviews past decisions
   - Continues from last task
   - **Updates state** as it progresses

4. **Throughout Development**
   - Every action is recorded
   - Every pattern is stored
   - Every decision is documented
   - State is continuously updated
   - Memory naturally decays (less important items fade)

---

## 🎨 Memory Sectors

### 1. Semantic Memory
**What**: Factual knowledge, project structure
**Example**: "The backend uses TypeScript with Express"
**Decay**: Very slow (important facts persist)

### 2. Episodic Memory
**What**: Events, actions taken by agents
**Example**: "Agent architect created database schema at 2pm"
**Decay**: Medium-fast (recent history more relevant)

### 3. Procedural Memory
**What**: How-to knowledge, patterns
**Example**: "Use Repository pattern for data access"
**Decay**: Medium (useful patterns persist)

### 4. Reflective Memory
**What**: Meta-insights, architectural decisions
**Example**: "Chose SQLite for simplicity over PostgreSQL"
**Decay**: Very slow (important decisions persist)

---

## 📚 Documentation

### For AI Agents
1. **START_HERE.md** - Overview of AI agents system
2. **INTEGRATION_GUIDE.md** - How to use OpenMemory integration
3. **AI_AGENT_SYSTEM_INSTRUCTIONS.md** - Template customization

### For Developers
1. **INTEGRATION_GUIDE.md** - API reference and usage
2. **ARCHITECTURE.md** (project root) - OpenMemory architecture
3. **README.md** (project root) - OpenMemory overview

---

## 🛠️ Configuration

Edit `config.json` to customize the integration:

```json
{
  "openmemory": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "fallback_to_local": true
  },
  "agent_config": {
    "record_actions": true,
    "record_decisions": true,
    "store_patterns": true,
    "query_context_on_resume": true
  },
  "state_management": {
    "primary_storage": "openmemory",
    "sync_to_local": true
  }
}
```

---

## 🔥 Key Features

### 1. Cross-Session Memory
Work can span days, weeks, or months. The AI picks up exactly where it left off.

### 2. Semantic Search
```python
# Find relevant patterns
patterns = client.query_memories(
    query="authentication implementation",
    memory_type="patterns",
    k=5
)
```

### 3. Development History
```python
# See what was done before
history = client.get_history(limit=20)
for action in history:
    print(action['content'])
```

### 4. Decision Tracking
```python
# Understand why choices were made
decisions = client.get_decisions()
for decision in decisions:
    print(f"{decision['decision']}: {decision['rationale']}")
```

### 5. Pattern Recognition
```python
# Learn from past solutions
patterns = client.get_patterns()
for pattern in patterns:
    print(f"{pattern['pattern_name']}: {pattern['description']}")
```

### 6. Intelligent Context
```python
# Get full context for informed decisions
context = client.get_full_context()
# Contains: state, recent_actions, patterns, decisions
```

---

## 💻 API Examples

### Save State
```python
state = {
    "project_metadata": {
        "project_name": "OpenMemory",
        "current_phase": "development",
        "progress_percentage": 45
    },
    "services": {...},
    "next_recommended_tasks": [...]
}

client.save_project_state(state)
```

### Record Action
```python
client.record_action(
    agent_name="backend_developer",
    action="Implemented user authentication",
    context="Added JWT tokens and password hashing",
    outcome="success"
)
```

### Store Pattern
```python
client.store_pattern(
    pattern_name="Service Layer Pattern",
    description="Separate business logic from API routes",
    example="class UserService { async create(data) {...} }",
    tags=["architecture", "backend"]
)
```

### Record Decision
```python
client.record_decision(
    decision="Use JWT for authentication",
    rationale="Stateless, scalable, widely supported",
    alternatives="Sessions, OAuth only",
    consequences="Need to handle token refresh"
)
```

---

## 🎯 Best Practices

### For AI Agents

1. ✅ **Always check mode first** (`detect_mode()`)
2. ✅ **Load full context** when resuming
3. ✅ **Record every action** as you perform it
4. ✅ **Store patterns** when you discover them
5. ✅ **Document decisions** with clear rationale
6. ✅ **Save state frequently** (after major steps)
7. ✅ **Query context** before major changes
8. ✅ **Review history** to avoid redundant work

### For Developers

1. ✅ **Start OpenMemory first** before AI agents
2. ✅ **Monitor the dashboard** to see what's happening
3. ✅ **Review decisions** to understand architecture
4. ✅ **Check patterns** before implementing new features
5. ✅ **Export backups** of important states

---

## 🔧 Troubleshooting

### "OpenMemory not available"
**Solution**: Start the backend
```bash
cd backend && npm run dev
```

### "Connection refused"
**Solution**: Check if port 8080 is available
```bash
curl http://localhost:8080/health
```

### "Import error: openmemory_client"
**Solution**: Ensure you're in the correct directory
```bash
cd .ai-agents
python3 -c "import openmemory_client"
```

### "State not found (404)"
**This is normal** for new projects. The system will start in INITIALIZE mode.

---

## 📊 Monitoring

### Check Health
```bash
curl http://localhost:8080/health
```

### View Project State
```bash
curl http://localhost:8080/ai-agents/state/OpenMemory
```

### View History
```bash
curl http://localhost:8080/ai-agents/history/OpenMemory
```

### View Patterns
```bash
curl http://localhost:8080/ai-agents/patterns/OpenMemory
```

### View Decisions
```bash
curl http://localhost:8080/ai-agents/decisions/OpenMemory
```

---

## 🌟 Benefits

### vs. Traditional File-Based State
- ✅ Semantic search (not just text search)
- ✅ Natural language queries
- ✅ Cross-session memory
- ✅ Automatic decay of irrelevant info
- ✅ Linked memories (waypoint graphs)
- ✅ Multi-sector organization

### vs. Vector Databases Only
- ✅ Cognitive memory model (5 sectors)
- ✅ Time-aware decay
- ✅ Reinforcement learning
- ✅ Explainable retrieval paths
- ✅ User isolation
- ✅ Self-hosted privacy

---

## 🚀 Next Steps

### If You're an AI Agent:

1. Run `python3 detect-state.py`
2. If INITIALIZE: Read `INTEGRATION_GUIDE.md` and start fresh
3. If RESUME: Load context and continue from last task
4. Always record actions, patterns, and decisions
5. Update state after each major step

### If You're a Developer:

1. Read `INTEGRATION_GUIDE.md` for comprehensive documentation
2. Explore the API endpoints
3. Monitor the OpenMemory dashboard
4. Review recorded decisions and patterns
5. Consider extending the system for your use case

---

## 📝 License

This integration is part of the OpenMemory project.
MIT License - Copyright (c) 2025 OpenMemory.

---

## 🙏 Credits

- **OpenMemory**: Self-hosted AI memory engine
- **AI Agents System**: Autonomous development framework
- **Integration**: Combines the best of both worlds

---

**Ready to build something amazing? Let the AI agents do the work while OpenMemory remembers everything!** 🚀
