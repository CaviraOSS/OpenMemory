#!/usr/bin/env python3
"""Save initial project state to OpenMemory"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
from datetime import datetime

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)

print("=== Saving Initial Project State ===\n")

# Create comprehensive project state
project_state = {
    "project_metadata": {
        "project_name": "OpenMemory",
        "description": "Long-term memory for AI systems. Open source, self-hosted, and explainable.",
        "version": "2.0-hsg-tiered",
        "current_phase": "Production",
        "progress_percentage": 100,
        "repository": "https://github.com/caviraoss/openmemory",
        "initialized_at": datetime.now().isoformat(),
        "initialized_by": "claude-code"
    },

    "technology_stack": {
        "backend": {
            "language": "TypeScript",
            "runtime": "Node.js",
            "framework": "Express.js",
            "build_tool": "tsx/tsc"
        },
        "storage": {
            "primary": "SQLite",
            "alternative": "PostgreSQL",
            "schema_version": "2.0"
        },
        "embeddings": {
            "providers": ["OpenAI", "Gemini", "Ollama", "local", "synthetic"],
            "current": "synthetic",
            "dimensions": 256,
            "mode": "simple"
        },
        "protocols": {
            "rest_api": "http://localhost:8080",
            "mcp": "Model Context Protocol supported",
            "langgraph": "Optional integration"
        }
    },

    "architecture": {
        "model": "Hierarchical Memory Decomposition (HMD) v2",
        "sectors": {
            "episodic": {"decay_lambda": 0.020, "weight": 1.2, "description": "Events and experiences"},
            "semantic": {"decay_lambda": 0.005, "weight": 1.0, "description": "Facts and knowledge"},
            "procedural": {"decay_lambda": 0.008, "weight": 1.1, "description": "How-to and processes"},
            "emotional": {"decay_lambda": 0.015, "weight": 1.3, "description": "Feelings and sentiments"},
            "reflective": {"decay_lambda": 0.001, "weight": 0.8, "description": "Meta-cognition and insights"}
        },
        "graph": {
            "type": "Single-waypoint linking",
            "threshold": 0.75,
            "reinforcement": True,
            "pruning_interval": "7 days"
        },
        "scoring": {
            "similarity": 0.6,
            "salience": 0.2,
            "recency": 0.1,
            "waypoint": 0.1
        }
    },

    "ai_agents_integration": {
        "status": "Fully integrated",
        "version": "1.0",
        "endpoints": [
            "/ai-agents/state",
            "/ai-agents/action",
            "/ai-agents/pattern",
            "/ai-agents/decision",
            "/ai-agents/query",
            "/ai-agents/history/:project",
            "/ai-agents/patterns/:project",
            "/ai-agents/decisions/:project",
            "/ai-agents/context/:project",
            "/ai-agents/reinforce/:memory_id"
        ],
        "mapping": {
            "state": "semantic sector",
            "actions": "episodic sector",
            "patterns": "procedural sector",
            "decisions": "reflective sector"
        },
        "client_library": ".ai-agents/openmemory_client.py"
    },

    "key_features": [
        "Multi-sector memory with cognitive architecture",
        "Automatic memory decay and reinforcement",
        "Graph associations between memories",
        "User isolation with user_id",
        "Multiple embedding providers",
        "Self-hosted and open source",
        "95% recall accuracy",
        "338 QPS throughput",
        "7.9 ms/item scalability"
    ],

    "performance_characteristics": {
        "response_time": "115 ms average (100k nodes)",
        "throughput": "338 QPS (8 workers)",
        "recall_accuracy": "95%",
        "scalability": "7.9 ms/item @ 10k+ entries",
        "storage": "~4-6 KB per memory"
    },

    "documentation": {
        "readme": "README.md",
        "architecture": "ARCHITECTURE.md",
        "why": "Why.md",
        "contributing": "CONTRIBUTING.md",
        "security": "SECURITY.md",
        "ai_agents_guide": ".ai-agents/INTEGRATION_GUIDE.md",
        "api_docs": "https://openmemory.cavira.app"
    },

    "directory_structure": {
        "backend": "TypeScript backend (src/)",
        "dashboard": "Next.js dashboard",
        ".ai-agents": "AI Agents integration files",
        "docs": "Documentation",
        "tests": "Test suite"
    },

    "analysis_summary": {
        "patterns_identified": 5,
        "patterns": [
            "Multi-Sector Memory Classification",
            "Single-Waypoint Graph Linking",
            "Composite Scoring for Memory Retrieval",
            "Sector-Specific Memory Decay",
            "AI Agent Activity Mapping"
        ],
        "architectural_decisions": 5,
        "decisions": [
            "HMD Architecture",
            "TypeScript Backend",
            "SQLite Primary Storage",
            "Multi-Provider Embedding Support",
            "Express.js API Layer"
        ],
        "actions_recorded": 2
    }
}

# Save the state
result = client.save_project_state(project_state)
print(f"[OK] Project state saved: {result.get('memory_id')}")
print(f"Message: {result.get('message')}")

# Verify by loading it back
print("\n=== Verifying State Storage ===\n")
loaded_state = client.load_project_state()
if loaded_state:
    print("[OK] State verification successful")
    print(f"Project: {loaded_state.get('project_metadata', {}).get('project_name')}")
    print(f"Version: {loaded_state.get('project_metadata', {}).get('version')}")
    print(f"Architecture: {loaded_state.get('architecture', {}).get('model')}")
    print(f"Sectors: {len(loaded_state.get('architecture', {}).get('sectors', {}))}")
    print(f"AI Agents Status: {loaded_state.get('ai_agents_integration', {}).get('status')}")
else:
    print("[ERROR] Could not load state back")

print("\n=== Initial Project State Saved Successfully ===")
