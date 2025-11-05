#!/usr/bin/env python3
"""Record action in OpenMemory"""

import sys
sys.path.insert(0, '..')

from openmemory_client import OpenMemoryClient

client = OpenMemoryClient(
    base_url="http://localhost:8080",
    project_name="OpenMemory",
    user_id="ai-agent-system"
)

# Record initial action
result = client.record_action(
    agent_name="claude-code",
    action="Started working on OpenMemory project",
    context="Loaded project context, detected INITIALIZE mode. OpenMemory v2.0-hsg-tiered is running with synthetic embeddings (256 dimensions) in hybrid tier.",
    outcome="Successfully connected to OpenMemory server and loaded context. Ready to explore codebase and record findings."
)

print(f"[OK] Action recorded: {result.get('memory_id', 'unknown')}")
