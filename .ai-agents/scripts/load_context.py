#!/usr/bin/env python3
"""Load OpenMemory project context"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
import json

# Initialize client for the OpenMemory project itself
client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)

print("=== OpenMemory Project Context ===\n")

# Check server health
health = client.health_check()
if health.get("ok"):
    print(f"[OK] Connected to OpenMemory (v{health.get('version', 'unknown')})")
    print(f"  Embedding: {health.get('embedding', {}).get('provider')} ({health.get('dim')} dimensions)")
    print(f"  Tier: {health.get('tier')}\n")

# Detect mode
mode = client.detect_mode()
print(f"Mode: {mode}\n")

# Load project state
print("=== Project State ===")
state = client.load_project_state()
if state:
    print(json.dumps(state, indent=2))
else:
    print("No project state found")

# Get development history
print("\n=== Development History (last 10 actions) ===")
history = client.get_history(limit=10)
if history:
    for i, entry in enumerate(history[-10:], 1):
        print(f"{i}. [{entry.get('agent_name', 'unknown')}] {entry.get('action', 'N/A')}")
        if entry.get('outcome'):
            print(f"   → {entry.get('outcome')}")
else:
    print("No history found")

# Get patterns
print("\n=== Coding Patterns ===")
patterns = client.get_patterns()
if patterns:
    for i, pattern in enumerate(patterns, 1):
        print(f"{i}. {pattern.get('pattern_name', 'N/A')}: {pattern.get('description', 'N/A')}")
else:
    print("No patterns found")

# Get architectural decisions
print("\n=== Architectural Decisions ===")
decisions = client.get_decisions()
if decisions:
    for i, decision in enumerate(decisions, 1):
        print(f"{i}. {decision.get('decision', 'N/A')}")
        print(f"   Rationale: {decision.get('rationale', 'N/A')}")
else:
    print("No decisions found")

# Get full context
print("\n=== Full Context Summary ===")
try:
    full_context = client.get_full_context()
    print(f"State entries: {len(full_context.get('state_history', []))}")
    print(f"Actions: {len(full_context.get('actions', []))}")
    print(f"Patterns: {len(full_context.get('patterns', []))}")
    print(f"Decisions: {len(full_context.get('decisions', []))}")
except Exception as e:
    print(f"Could not fetch full context: {e}")

print("\n=== Ready to work on OpenMemory project ===")
