#!/usr/bin/env python3
"""
AI Agent Initialization Detector (OpenMemory-Enabled)

This script automatically detects whether the AI agent should:
1. Start fresh (initialize project)
2. Resume work (continue from previous state)

It now uses OpenMemory for persistent state management across sessions.
Falls back to local file if OpenMemory is not available.

Usage: python .ai-agents/detect-state.py

Returns:
- "INITIALIZE" if starting fresh
- "RESUME" with current state if resuming
"""

import json
import os
from pathlib import Path

# Try to import OpenMemory client
try:
    from openmemory_client import OpenMemoryClient
    OPENMEMORY_AVAILABLE = True
except ImportError:
    OPENMEMORY_AVAILABLE = False

def detect_state():
    """Detect current project state and provide guidance."""

    project_root = Path(__file__).parent.parent
    project_name = project_root.name
    state_file = project_root / ".ai-agents" / "project-state.json"

    print("=" * 70)
    print("AI AGENT INITIALIZATION DETECTOR (OpenMemory-Enabled)")
    print("=" * 70)
    print()

    # Try OpenMemory first if available
    if OPENMEMORY_AVAILABLE:
        try:
            client = OpenMemoryClient(
                base_url=os.environ.get("OPENMEMORY_URL", "http://localhost:8080"),
                project_name=project_name,
            )

            # Check if OpenMemory is running
            health = client.health_check()
            if health.get("ok"):
                print(f"✓ Connected to OpenMemory (v{health.get('version', 'unknown')})")
                print()

                # Try to load state from OpenMemory
                state = client.load_project_state()

                if state:
                    # RESUME mode from OpenMemory
                    print("✓ STATUS: RESUME MODE (OpenMemory)")
                    print()
                    print("Project state loaded from OpenMemory's long-term memory.")
                    print()

                    print("CURRENT PROJECT STATE:")
                    print("-" * 70)
                    print(f"  Phase: {state['project_metadata']['current_phase']}")
                    print(f"  Progress: {state['project_metadata']['progress_percentage']}%")
                    print(f"  Last Updated: {state['project_metadata']['last_updated']}")
                    print(f"  Active Agent: {state['project_metadata']['active_agent']}")
                    print()

                    print("NEXT RECOMMENDED TASKS:")
                    print("-" * 70)
                    for i, task in enumerate(state.get('next_recommended_tasks', [])[:3], 1):
                        print(f"  {i}. {task['task']}")
                        print(f"     Agent: {task['agent']}")
                        print(f"     Priority: {task['priority']}")
                        print()

                    print("DEVELOPMENT HISTORY (Recent Actions):")
                    print("-" * 70)
                    history = client.get_history(limit=5)
                    for entry in history[:5]:
                        print(f"  • {entry.get('content', 'N/A')[:100]}")
                    print()

                    print("ACTION FOR AI AGENT:")
                    print("-" * 70)
                    print("  1. Use OpenMemory client to retrieve full context")
                    print("  2. Continue with next_recommended_tasks")
                    print("  3. Record all actions in OpenMemory")
                    print("  4. Update state as you complete tasks")
                    print()

                    return "RESUME"
                else:
                    # INITIALIZE mode - no state in OpenMemory
                    print("✓ STATUS: INITIALIZE MODE (OpenMemory)")
                    print()
                    print("No project state found in OpenMemory.")
                    print("This is a fresh start.")
                    print()

                    print("ACTION FOR AI AGENT:")
                    print("-" * 70)
                    print("  1. Read README.md for architecture overview")
                    print("  2. Read .ai-agents/README.md for system documentation")
                    print("  3. Begin Phase 1: Foundation & Infrastructure")
                    print("  4. Use OpenMemory client to store all state and actions")
                    print()

                    print("FIRST STEPS:")
                    print("-" * 70)
                    print("  1. Create project directory structure")
                    print("  2. Initialize project state in OpenMemory")
                    print("  3. Begin implementing foundation components")
                    print("  4. Record all decisions and patterns in OpenMemory")
                    print()

                    return "INITIALIZE"
        except Exception as e:
            print(f"⚠ OpenMemory not available: {e}")
            print("Falling back to local file system...")
            print()
    else:
        print("⚠ OpenMemory client not found (openmemory_client.py)")
        print("Using local file system for state management")
        print()

    # Fallback to local file system
    if state_file.exists():
        # RESUME mode
        print("✓ STATUS: RESUME MODE")
        print()
        print("The .ai-agents/project-state.json file exists.")
        print("This means development was previously started.")
        print()

        try:
            with open(state_file, 'r') as f:
                state = json.load(f)

            print("CURRENT PROJECT STATE:")
            print("-" * 70)
            print(f"  Phase: {state['project_metadata']['current_phase']}")
            print(f"  Last Updated: {state['project_metadata']['last_updated']}")
            print(f"  Active Agent: {state['project_metadata']['active_agent']}")
            print()

            print("NEXT RECOMMENDED TASKS:")
            print("-" * 70)
            for i, task in enumerate(state.get('next_recommended_tasks', [])[:3], 1):
                print(f"  {i}. {task['task']}")
                print(f"     Agent: {task['agent']}")
                print(f"     Priority: {task['priority']}")
                print()

            # Count completed vs total services
            completed = 0
            in_progress = 0
            not_started = 0

            for category in ['infrastructure_services', 'core_business_services',
                           'ats_services', 'template_services', 'data_services']:
                for service, info in state['services'].get(category, {}).items():
                    status = info.get('status', 'not_started')
                    if status == 'completed':
                        completed += 1
                    elif status == 'in_progress':
                        in_progress += 1
                    else:
                        not_started += 1

            total = completed + in_progress + not_started
            if total > 0:
                completion = (completed / total) * 100
                print("PROGRESS SUMMARY:")
                print("-" * 70)
                print(f"  Completed: {completed}/{total} services ({completion:.1f}%)")
                print(f"  In Progress: {in_progress} services")
                print(f"  Not Started: {not_started} services")
                print()

            print("ACTION FOR AI AGENT:")
            print("-" * 70)
            print("  1. Read .ai-agents/project-state.json for full context")
            print("  2. Continue with next_recommended_tasks")
            print("  3. Update state as you complete tasks")
            print()

            return "RESUME"

        except Exception as e:
            print(f"⚠ Warning: Could not read state file: {e}")
            print("You may need to manually inspect .ai-agents/project-state.json")
            return "RESUME"

    else:
        # INITIALIZE mode
        print("✓ STATUS: INITIALIZE MODE")
        print()
        print("The .ai-agents/project-state.json file does NOT exist.")
        print("This is a fresh start.")
        print()

        print("ACTION FOR AI AGENT:")
        print("-" * 70)
        print("  1. Read README.md for architecture overview")
        print("  2. Read .ai-agents/README.md for system documentation")
        print("  3. Begin Phase 1: Foundation & Infrastructure")
        print("  4. The system will guide you through initialization")
        print()

        print("FIRST STEPS:")
        print("-" * 70)
        print("  1. Create project directory structure")
        print("  2. Implement shared libraries (libs/)")
        print("  3. Build infrastructure services (service_registry, event_bus)")
        print("  4. Update project-state.json as you progress")
        print()

        return "INITIALIZE"

    print("=" * 70)

if __name__ == "__main__":
    mode = detect_state()
    exit(0 if mode == "RESUME" else 1)
