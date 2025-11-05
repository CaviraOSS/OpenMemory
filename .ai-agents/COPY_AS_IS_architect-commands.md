# AI Architect Command System

## Overview

This document defines the command system that allows the AI Architect to seamlessly resume development from any point in the project lifecycle. The system is designed to provide complete context awareness and automatic task continuation.

## Core Commands

### 1. Read Command

**Syntax:** `Read {filename}`

**Purpose:** Resume work by reading any file in the project. The system automatically loads context and determines next steps.

**How It Works:**

1. **File is Read:** The specified file is loaded
2. **Automatic Context Loading:** Based on the file type, additional context files are automatically loaded:
   - Always loads: `project-state.json`, `README.md`
   - For service files: `workflow-tracker.json`, service dependencies
   - For infrastructure files: deployment configurations
   - For test files: corresponding service implementations

3. **Intelligent Analysis:**
   - Checks `project-state.json` for current development phase
   - Reviews service dependencies and their completion status
   - Identifies blocking issues
   - Determines appropriate next steps

4. **Action Execution:**
   - Executes agent-specific actions from `context-manager.json`
   - Updates project state
   - Provides recommendations for next tasks

### Read Command Examples

#### Example 1: Starting Fresh

```
User: "Read README.md"

AI Architect Actions:
1. Load README.md
2. Load project-state.json (shows project is in initialization phase)
3. Load mermaid.png for architecture reference
4. Analyze current_phase: "initialization"
5. Check next_recommended_tasks:
   - Create project directory structure
   - Implement shared libraries foundation
   - Build service registry
6. Execute Action: Create comprehensive project directory structure
7. Update project-state.json with progress
8. Report to user: "Project is in initialization phase. I've created the directory structure. Next: Implementing shared libraries."
```

#### Example 2: Resuming Service Development

```
User: "Read services/ai_manager/main.py"

AI Architect Actions:
1. Load services/ai_manager/main.py
2. Load project-state.json
3. Check ai_manager service status: "in_progress", 60% complete
4. Load dependencies: service_registry (complete), event_bus (complete), config_service (complete)
5. Analyze what's implemented vs. what's missing
6. Check workflow-tracker.json for event handlers needed
7. Execute Action: Implement missing endpoints and event handlers
8. Update project-state.json: ai_manager now 80% complete
9. Report: "AI Manager is 80% complete. Implemented missing endpoints. Next: Add unit tests."
```

#### Example 3: Checking Overall Progress

```
User: "Read project-state.json"

AI Architect Actions:
1. Load project-state.json
2. Analyze all service statuses
3. Calculate overall project completion
4. Identify blocking issues
5. Review next_recommended_tasks
6. Report comprehensive status:
   - Phase 1 (Foundation): 75% complete
   - Phase 2 (Core Services): 40% complete
   - Blocking issues: None
   - Next priority: Complete File Manager service (dependencies ready)
   - Estimated tasks remaining: 45
```

#### Example 4: Infrastructure Work

```
User: "Read infrastructure/local/docker-compose.yml"

AI Architect Actions:
1. Load docker-compose.yml
2. Load project-state.json deployment section
3. Check which services are configured vs. implemented
4. Identify missing service configurations
5. Execute Action: Add configurations for newly implemented services
6. Update project-state.json deployment status
7. Report: "Added Docker Compose configs for 3 new services. Ready for local deployment testing."
```

#### Example 5: Workflow Implementation

```
User: "Read workflow-tracker.json"

AI Architect Actions:
1. Load workflow-tracker.json
2. Check resume_generation workflow status
3. Review each step's implementation status
4. Check which services are ready for their workflow steps
5. Identify next implementable workflow step
6. Execute Action: Implement next workflow step with saga pattern
7. Update workflow-tracker.json with progress
8. Report: "Resume generation workflow 50% complete. Implemented steps 1-3. Next: ATS optimization step."
```

## Automatic Context System

### Context Loading Rules

When any file is read, the system automatically loads related context:

```json
{
  "file_pattern": "services/{service_name}/*",
  "auto_load": [
    "project-state.json → services section → {service_name}",
    "workflow-tracker.json → relevant workflows",
    "README.md → service catalog → {service_name} entry",
    "Dependencies from project-state.json"
  ]
}
```

### Intelligent Resume Protocol

The system follows this protocol to resume work from any point:

```
1. Determine Context
   ↓
2. Load Related Files
   ↓
3. Analyze Current State
   ↓
4. Check Dependencies
   ↓
5. Identify Next Steps
   ↓
6. Execute Actions
   ↓
7. Update State
   ↓
8. Report Progress
```

## Agent Assignment System

### Automatic Agent Selection

Based on the file being read and the task required, the system automatically determines which specialized agent should handle the work:

| File Pattern | Assigned Agent | Rationale |
|-------------|----------------|-----------|
| `services/ai_*/*.py` | service_developer (ai_specialist) | AI service implementation |
| `services/file_*/*.py` | service_developer (file_specialist) | File handling |
| `services/ats_*/*.py` | service_developer (ats_specialist) | ATS services |
| `services/latex_*/*.py` | service_developer (template_specialist) | Template services |
| `libs/*/*.py` | infrastructure_developer | Shared libraries |
| `infrastructure/*` | devops_engineer | Deployment |
| `tests/*` | qa_engineer | Testing |
| `*.tf` | devops_engineer | Infrastructure as Code |

### Agent Handoff

When work requires multiple agents:

```
1. Architect reads file and plans work
2. Architect assigns task to specialized agent via project-state.json
3. Specialized agent completes task
4. Agent updates project-state.json with completion
5. Architect reviews completion and assigns next task
```

## State Management

### Project State Updates

Every action updates `project-state.json`:

```json
{
  "services": {
    "ai_manager": {
      "status": "in_progress",
      "completion_percentage": 75,
      "files": ["services/ai_manager/main.py", "services/ai_manager/models.py"],
      "last_updated": "2025-11-04T10:30:00Z",
      "assigned_agent": "service_developer"
    }
  },
  "active_agent": "service_developer",
  "next_recommended_tasks": [
    {
      "task": "Complete AI Manager unit tests",
      "agent": "qa_engineer",
      "priority": "high"
    }
  ]
}
```

### Workflow State Updates

Workflow progress is tracked in `workflow-tracker.json`:

```json
{
  "workflows": {
    "resume_generation": {
      "progress_percentage": 50,
      "steps": [
        {
          "step_number": 1,
          "status": "complete",
          "implementation_status": "complete"
        },
        {
          "step_number": 2,
          "status": "in_progress",
          "implementation_status": "partial"
        }
      ]
    }
  }
}
```

## Usage Patterns

### Pattern 1: Daily Startup

```
User: "Read project-state.json"
AI: Provides comprehensive status update and next priority tasks
User: Can then dive into specific task with another Read command
```

### Pattern 2: Continuing Specific Work

```
User: "Read services/template_manager/main.py"
AI: Analyzes service, implements next feature, updates state
```

### Pattern 3: Checking Workflow Progress

```
User: "Read workflow-tracker.json"
AI: Reports workflow status, implements next workflow step
```

### Pattern 4: Infrastructure Updates

```
User: "Read infrastructure/local/docker-compose.yml"
AI: Updates configurations based on newly implemented services
```

## Advanced Features

### Dependency-Aware Task Ordering

The system never attempts to implement a service before its dependencies are ready:

```python
# Automatic dependency checking
if service_dependencies_complete(service_name):
    implement_service(service_name)
else:
    report_blocking_dependencies(service_name)
    suggest_alternative_tasks()
```

### Parallel Task Identification

The system identifies tasks that can be done in parallel:

```json
{
  "parallel_tasks": [
    {
      "task": "Implement Cache Service",
      "agent": "infrastructure_developer",
      "can_run_parallel_with": ["Implement Storage Service"]
    },
    {
      "task": "Implement Storage Service",
      "agent": "infrastructure_developer",
      "can_run_parallel_with": ["Implement Cache Service"]
    }
  ]
}
```

### Automatic Blocker Detection

The system detects and reports blocking issues:

```
Blocker Detected:
- ATS Optimization service blocked by incomplete Keyword Manager
- Resolution: Complete Keyword Manager first
- Alternative: Work on Template Services (no blockers)
```

## Complete Development Lifecycle Support

### Phase 1: Initial Setup (0-10%)

```
Read README.md → Create directory structure → Implement shared libraries
```

### Phase 2: Foundation (10-30%)

```
Read libs/service_discovery → Implement infrastructure services → Test service registry
```

### Phase 3: Core Services (30-60%)

```
Read services/{service}/main.py → Implement business logic → Add tests
```

### Phase 4: Integration (60-80%)

```
Read workflow-tracker.json → Implement workflows → Add event handlers → Test integration
```

### Phase 5: Deployment (80-90%)

```
Read docker-compose.yml → Configure deployment → Test locally → Deploy to AWS
```

### Phase 6: Finalization (90-100%)

```
Read test coverage → Add missing tests → Documentation → Performance optimization
```

## Error Recovery

### When Work Was Interrupted

The system automatically handles interrupted work:

```
1. Check project-state.json for active_agent
2. Check last service being worked on
3. Load that service's files
4. Determine what was completed vs. in-progress
5. Resume from last completed point
6. Report: "Resuming work on AI Manager. Last completed: database models. Continuing with API endpoints."
```

### When Dependencies Change

If a dependency was updated after a service was partially implemented:

```
1. Detect dependency version change
2. Analyze impact on dependent services
3. Report affected services
4. Suggest re-testing or updates needed
```

## Best Practices

### For Optimal Continuity

1. **Always start with:** `Read project-state.json` to get current status
2. **To resume specific work:** `Read {specific-file}` for that component
3. **To check workflows:** `Read workflow-tracker.json`
4. **To review architecture:** `Read README.md` and `Read mermaid.png`

### For Maximum Efficiency

1. Let the system determine next tasks (trust `next_recommended_tasks`)
2. Follow dependency order (system enforces this automatically)
3. Update state after each completion (system does this automatically)
4. Review progress periodically with `Read project-state.json`

## Summary

The AI Architect Command System provides:

✅ **Seamless Resume:** Start from any point, any file
✅ **Full Context:** Automatic loading of related information
✅ **Intelligent Next Steps:** System determines what to do next
✅ **Dependency Management:** Never work on blocked tasks
✅ **Progress Tracking:** Always know exactly where you are
✅ **Multi-Agent Coordination:** Right agent for each task
✅ **State Persistence:** All progress saved automatically

**Simple Usage:** Just say `Read {filename}` and the system handles the rest!
