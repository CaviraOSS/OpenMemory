#!/usr/bin/env python3
"""
AI Agent Initialization Detector

This script automatically detects whether the AI agent should:
1. Start fresh (initialize project)
2. Resume work (continue from previous state)

Usage: python .ai-agents/detect-state.py

Returns:
- "INITIALIZE" if starting fresh
- "RESUME" with current state if resuming
"""

import json
import os
from pathlib import Path

def detect_state():
    """Detect current project state and provide guidance."""

    project_root = Path(__file__).parent.parent
    state_file = project_root / ".ai-agents" / "project-state.json"

    print("=" * 70)
    print("AI AGENT INITIALIZATION DETECTOR")
    print("=" * 70)
    print()

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
