# OpenMemory + AI Agents System Integration Guide

## Overview

This guide explains how the **AI Agents Autonomous Development System** and **OpenMemory** are integrated to create a powerful, memory-enabled development environment for AI agents.

## What This Integration Provides

### 1. **Persistent Long-Term Memory**
- All project state is stored in OpenMemory's semantic memory
- Development history tracked in episodic memory
- Patterns and best practices stored in procedural memory
- Architectural decisions recorded in reflective memory

### 2. **Cross-Session Continuity**
- AI agents can resume work across multiple sessions
- Full context is maintained indefinitely
- No data loss between sessions
- Natural memory decay for less important information

### 3. **Intelligent Context Retrieval**
- Semantic search for relevant past decisions
- Pattern recognition from previous work
- Contextual recommendations based on history
- Linked memories through waypoint graphs

### 4. **Multi-Agent Coordination**
- Shared memory across all AI agents
- Action history for accountability
- Decision tracking for consistency
- Pattern sharing for best practices

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI AGENTS SYSTEM                          │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────┐        │
│  │ Architect   │  │ Developer   │  │   DevOps     │        │
│  │   Agent     │  │   Agent     │  │    Agent     │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬───────┘        │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                  │
│                    ┌──────▼──────┐                           │
│                    │ OpenMemory  │                           │
│                    │   Client    │                           │
│                    └──────┬──────┘                           │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    ┌───────▼───────┐
                    │  OpenMemory   │
                    │    Server     │
                    │  (Port 8080)  │
                    └───────┬───────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
  ┌──────────┐      ┌─────────────┐     ┌──────────┐
  │Semantic  │      │  Episodic   │     │Procedural│
  │ Memory   │      │   Memory    │     │  Memory  │
  │(States)  │      │ (Actions)   │     │(Patterns)│
  └──────────┘      └─────────────┘     └──────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │  Reflective  │
                    │   Memory     │
                    │ (Decisions)  │
                    └──────────────┘
```

---

## Installation & Setup

### Prerequisites

1. **OpenMemory Backend** must be running:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
   OpenMemory will be available at `http://localhost:8080`

2. **Python 3.7+** for AI agents integration library

### Setup Steps

1. **Verify OpenMemory is Running**
   ```bash
   curl http://localhost:8080/health
   ```
   Should return: `{"ok": true, "version": "..."}`

2. **Test the Integration**
   ```bash
   cd .ai-agents
   python3 openmemory_client.py
   ```
   Should show: `✓ OpenMemory server is running`

3. **Check Project State Detection**
   ```bash
   python3 detect-state.py
   ```
   Should show either `INITIALIZE` or `RESUME` mode

---

## Usage Guide

### For AI Agents

When an AI agent starts working on this project, it should:

1. **Run State Detection**
   ```python
   from openmemory_client import OpenMemoryClient

   client = OpenMemoryClient(
       base_url="http://localhost:8080",
       project_name="OpenMemory"
   )

   mode = client.detect_mode()
   # Returns: "INITIALIZE" or "RESUME"
   ```

2. **Initialize Mode (Fresh Project)**
   ```python
   # Load project context
   context = client.get_full_context()

   # Start development
   # ... implement features ...

   # Record all actions
   client.record_action(
       agent_name="architect",
       action="Created project structure",
       context="Set up directories and initial files",
       outcome="success"
   )

   # Store patterns learned
   client.store_pattern(
       pattern_name="MVC Architecture",
       description="Model-View-Controller pattern for web apps",
       example="..."
   )

   # Record decisions
   client.record_decision(
       decision="Use TypeScript for backend",
       rationale="Better type safety and tooling support",
       alternatives="JavaScript, Python",
       consequences="Requires compilation step"
   )

   # Save project state
   state = {
       "project_metadata": {
           "project_name": "OpenMemory",
           "current_phase": "foundation",
           "progress_percentage": 10,
           "active_agent": "architect",
           ...
       },
       "services": {...},
       "next_recommended_tasks": [...]
   }
   client.save_project_state(state)
   ```

3. **Resume Mode (Existing Project)**
   ```python
   # Load full context including history
   context = client.get_full_context()

   state = context['state']
   recent_actions = context['recent_actions']
   patterns = context['patterns']
   decisions = context['decisions']

   # Review what was done
   for action in recent_actions:
       print(f"Previous: {action['content']}")

   # Continue from last task
   next_tasks = state['next_recommended_tasks']
   current_task = next_tasks[0]

   # Implement current task
   # ...

   # Update state
   state['project_metadata']['progress_percentage'] = 25
   client.save_project_state(state)
   ```

4. **Query Past Context**
   ```python
   # Search for relevant information
   results = client.query_memories(
       query="authentication implementation",
       memory_type="patterns",
       k=5
   )

   for memory in results:
       print(f"Pattern: {memory['content']}")
   ```

### For Developers

**View Project State:**
```bash
curl http://localhost:8080/ai-agents/state/OpenMemory?user_id=ai-agent-system
```

**View Development History:**
```bash
curl http://localhost:8080/ai-agents/history/OpenMemory?limit=10
```

**View Coding Patterns:**
```bash
curl http://localhost:8080/ai-agents/patterns/OpenMemory
```

**View Architectural Decisions:**
```bash
curl http://localhost:8080/ai-agents/decisions/OpenMemory
```

**Get Full Context:**
```bash
curl http://localhost:8080/ai-agents/context/OpenMemory
```

---

## API Reference

### State Management

#### Save Project State
```http
POST /ai-agents/state
Content-Type: application/json

{
  "project_name": "OpenMemory",
  "state": { ... },
  "user_id": "ai-agent-system"
}
```

#### Load Project State
```http
GET /ai-agents/state/:project_name?user_id=ai-agent-system
```

### Action Recording

#### Record Agent Action
```http
POST /ai-agents/action
Content-Type: application/json

{
  "project_name": "OpenMemory",
  "agent_name": "architect",
  "action": "Created database schema",
  "context": "Added tables for users and memories",
  "outcome": "success",
  "user_id": "ai-agent-system"
}
```

#### Get Development History
```http
GET /ai-agents/history/:project_name?limit=50&user_id=ai-agent-system
```

### Pattern Storage

#### Store Coding Pattern
```http
POST /ai-agents/pattern
Content-Type: application/json

{
  "project_name": "OpenMemory",
  "pattern_name": "Repository Pattern",
  "description": "Abstraction layer for data access",
  "example": "class Repository { ... }",
  "tags": ["data-access", "design-pattern"],
  "user_id": "ai-agent-system"
}
```

#### Get All Patterns
```http
GET /ai-agents/patterns/:project_name?user_id=ai-agent-system
```

### Decision Recording

#### Record Architectural Decision
```http
POST /ai-agents/decision
Content-Type: application/json

{
  "project_name": "OpenMemory",
  "decision": "Use SQLite for storage",
  "rationale": "Simpler setup, no external dependencies",
  "alternatives": "PostgreSQL, MongoDB",
  "consequences": "May need to migrate for large deployments",
  "user_id": "ai-agent-system"
}
```

#### Get All Decisions
```http
GET /ai-agents/decisions/:project_name?user_id=ai-agent-system
```

### Context Retrieval

#### Query Memories
```http
POST /ai-agents/query
Content-Type: application/json

{
  "project_name": "OpenMemory",
  "query": "how to implement authentication",
  "memory_type": "patterns",
  "k": 10,
  "user_id": "ai-agent-system"
}
```

#### Get Full Context
```http
GET /ai-agents/context/:project_name?user_id=ai-agent-system
```

---

## Memory Sectors Explained

### 1. Semantic Memory (Project State)
- **Purpose**: Store factual knowledge about the project
- **Contains**: Project structure, configuration, component definitions
- **Decay Rate**: Slow (λ=0.005)
- **Use Case**: Current project state, architecture overview

### 2. Episodic Memory (Actions)
- **Purpose**: Record events and actions taken by agents
- **Contains**: "Agent X did Y at time Z"
- **Decay Rate**: Medium-Fast (λ=0.015)
- **Use Case**: Development timeline, action history

### 3. Procedural Memory (Patterns)
- **Purpose**: Store how-to knowledge and best practices
- **Contains**: Code patterns, implementation strategies
- **Decay Rate**: Medium (λ=0.008)
- **Use Case**: Reusable patterns, coding standards

### 4. Reflective Memory (Decisions)
- **Purpose**: Meta-cognitive insights and decisions
- **Contains**: Why decisions were made, trade-offs
- **Decay Rate**: Very Slow (λ=0.001)
- **Use Case**: Architectural rationale, important choices

---

## Configuration

Edit `.ai-agents/config.json` to customize:

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
    "store_patterns": true
  },
  "state_management": {
    "primary_storage": "openmemory",
    "sync_to_local": true
  }
}
```

---

## Benefits

### 1. **No Information Loss**
- All decisions, patterns, and actions are permanently stored
- Nothing is forgotten between sessions
- Complete audit trail of development

### 2. **Intelligent Recommendations**
- AI agents learn from past patterns
- Semantic search finds relevant precedents
- Context-aware suggestions

### 3. **Multi-Session Projects**
- Work can span days, weeks, or months
- Pick up exactly where you left off
- Full context always available

### 4. **Team Coordination**
- Multiple agents can coordinate through shared memory
- See what others have done
- Build on existing patterns and decisions

### 5. **Explainable Development**
- Every decision has a rationale
- Development history is transparent
- Audit trail for compliance

---

## Troubleshooting

### OpenMemory Not Available
```
⚠ OpenMemory not available: Connection refused
Falling back to local file system...
```

**Solution**: Start OpenMemory backend
```bash
cd backend && npm run dev
```

### State Not Found
```
ERROR: Project state not found
mode: INITIALIZE
```

**This is normal** for a new project. The AI agent should initialize the project.

### Import Error
```
ImportError: No module named 'openmemory_client'
```

**Solution**: Make sure `openmemory_client.py` is in `.ai-agents/` directory and you're running from the correct location.

---

## Advanced Features

### Reinforcement
Mark important memories to prevent decay:
```python
client.session.post(
    f"{client.base_url}/ai-agents/reinforce/{memory_id}",
    json={"boost": 0.3}
)
```

### Custom Queries
Search across multiple memory types:
```python
results = client.query_memories(
    query="database implementation",
    memory_type="all",  # Search all sectors
    k=20
)
```

### Batch Operations
Save multiple patterns at once:
```python
patterns = [
    {"pattern_name": "Factory", "description": "..."},
    {"pattern_name": "Observer", "description": "..."},
]

for pattern in patterns:
    client.store_pattern(**pattern)
```

---

## Best Practices

### For AI Agents

1. **Always record actions** as you perform them
2. **Store patterns** when you discover reusable solutions
3. **Record decisions** with clear rationale
4. **Query context** before making major changes
5. **Update state** frequently (after each major step)

### For Developers

1. **Start OpenMemory** before beginning AI agent work
2. **Review history** to understand what was done
3. **Check decisions** to understand architectural choices
4. **Query patterns** before implementing new features
5. **Monitor memory** using the dashboard

---

## Future Enhancements

Planned improvements to the integration:

- [ ] Automatic pattern recognition and extraction
- [ ] Cross-project pattern sharing
- [ ] Agent performance analytics
- [ ] Real-time collaboration between agents
- [ ] Visual memory graph exploration
- [ ] Export/import project memory snapshots

---

## Support

For issues or questions:
- OpenMemory: https://github.com/caviraoss/openmemory/issues
- AI Agents System: Check `.ai-agents/START_HERE.md`

---

## License

This integration guide is part of the OpenMemory project and is released under the MIT License.
