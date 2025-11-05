# AI Agents Integration Scripts

This directory contains utility scripts for working with the OpenMemory AI Agents integration.

## Overview

These scripts showcase the complete workflow for AI agents using OpenMemory's multi-sector memory system to maintain persistent development context across sessions.

## Scripts

### `load_context.py`
Load and display comprehensive project context from OpenMemory.

```bash
cd .ai-agents/scripts
python load_context.py
```

Shows:
- Connection status and server version
- Operating mode (INITIALIZE or RESUME)
- Project state
- Development history (last 10 actions)
- Stored coding patterns
- Architectural decisions
- Full context summary

### `record_action.py`
Record a single agent action in episodic memory.

```bash
python record_action.py
```

Example action recording with context and outcome.

### `store_findings.py`
Store discovered patterns and architectural decisions.

```bash
python store_findings.py
```

Stores:
- 5 coding patterns in procedural memory
- 5 architectural decisions in reflective memory
- Records the analysis action in episodic memory

### `save_state.py`
Save comprehensive project state to semantic memory.

```bash
python save_state.py
```

Saves detailed project metadata including:
- Technology stack
- Architecture details
- AI agents integration status
- Performance characteristics
- Documentation references

### `verify_storage.py`
Query and verify stored memories across all sectors.

```bash
python verify_storage.py
```

Queries:
- Coding patterns (procedural sector)
- Architectural decisions (reflective sector)
- Agent actions (episodic sector)
- Project state (semantic sector)

### `session_summary.py`
Generate a comprehensive session summary.

```bash
python session_summary.py
```

Displays:
- Project status
- Memory counts by type
- Identified patterns
- Recorded decisions
- Key findings
- Next steps

## Memory Sector Mapping

The AI Agents integration uses OpenMemory's cognitive memory sectors:

| Agent Activity | Memory Sector | Purpose |
|---------------|---------------|---------|
| Project State | Semantic | Facts and knowledge |
| Agent Actions | Episodic | Events and experiences |
| Coding Patterns | Procedural | How-to and processes |
| Architectural Decisions | Reflective | Meta-cognition and insights |

## Usage Pattern

### First Session (INITIALIZE Mode)
```bash
# 1. Load initial context (will be empty)
python load_context.py

# 2. Record your initial action
python record_action.py

# 3. Store any patterns/decisions you discover
python store_findings.py

# 4. Save comprehensive project state
python save_state.py

# 5. Verify everything was stored
python verify_storage.py

# 6. Generate summary
python session_summary.py
```

### Subsequent Sessions (RESUME Mode)
```bash
# 1. Load full context from previous sessions
python load_context.py

# 2. Continue development...

# 3. Record new actions as you work
# (modify record_action.py with your specific actions)

# 4. Generate summary at session end
python session_summary.py
```

## Client Configuration

All scripts use the OpenMemoryClient with these defaults:

```python
from openmemory_client import OpenMemoryClient

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)
```

Modify these values to:
- Point to a different OpenMemory server
- Work on a different project
- Use a different user namespace

## Requirements

- OpenMemory server running (typically on http://localhost:8080)
- Python 3.7+
- `requests` library (installed with openmemory_client.py)

## See Also

- **[openmemory_client.py](../openmemory_client.py)** - Python client library
- **[INTEGRATION_GUIDE.md](../INTEGRATION_GUIDE.md)** - Full integration guide
- **[README.md](../README.md)** - AI Agents system overview
- **[Main README.md](../../README.md)** - OpenMemory documentation
