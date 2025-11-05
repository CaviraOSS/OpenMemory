#!/usr/bin/env python3
"""Verify what was stored in OpenMemory"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient
import json

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)

print("=== Querying Stored Memories ===\n")

# Query for patterns
print("--- Coding Patterns ---")
patterns = client.query_memories(
    query="coding patterns architecture memory",
    memory_type="patterns",
    k=5
)
print(f"Found {len(patterns)} patterns")
for i, p in enumerate(patterns, 1):
    print(f"\n{i}. ID: {p.get('id', 'unknown')[:8]}...")
    print(f"   Content preview: {p.get('content', 'N/A')[:150]}...")
    if p.get('metadata'):
        print(f"   Metadata: {json.dumps(p.get('metadata'), indent=6)}")

# Query for decisions
print("\n\n--- Architectural Decisions ---")
decisions = client.query_memories(
    query="architectural decisions OpenMemory",
    memory_type="decisions",
    k=5
)
print(f"Found {len(decisions)} decisions")
for i, d in enumerate(decisions, 1):
    print(f"\n{i}. ID: {d.get('id', 'unknown')[:8]}...")
    print(f"   Content preview: {d.get('content', 'N/A')[:150]}...")
    if d.get('metadata'):
        print(f"   Metadata: {json.dumps(d.get('metadata'), indent=6)}")

# Query for actions
print("\n\n--- Agent Actions ---")
actions = client.query_memories(
    query="claude-code actions OpenMemory",
    memory_type="actions",
    k=5
)
print(f"Found {len(actions)} actions")
for i, a in enumerate(actions, 1):
    print(f"\n{i}. ID: {a.get('id', 'unknown')[:8]}...")
    print(f"   Content preview: {a.get('content', 'N/A')[:200]}...")
    if a.get('metadata'):
        print(f"   Metadata: {json.dumps(a.get('metadata'), indent=6)}")

# Query for project state
print("\n\n--- Project State ---")
state = client.query_memories(
    query="OpenMemory project state version architecture",
    memory_type="state",
    k=1
)
print(f"Found {len(state)} state records")
for i, s in enumerate(state, 1):
    print(f"\n{i}. ID: {s.get('id', 'unknown')[:8]}...")
    print(f"   Content preview: {s.get('content', 'N/A')[:300]}...")
    if s.get('metadata'):
        print(f"   Metadata: {json.dumps(s.get('metadata'), indent=6)}")

print("\n\n=== Verification Complete ===")
