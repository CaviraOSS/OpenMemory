# AI Agent System - Template Instructions

## Overview

This guide explains how to configure the AI Agent system for any software development project. The system enables AI agents to autonomously develop your entire project from start to finish.

## 📁 File Structure

All files must be placed in the `.ai-agents/` folder in your project root:

```
your-project/
├── .ai-agents/
│   ├── agent-roles.json              # Define agent capabilities
│   ├── architect-commands.md         # Command system documentation (usually no changes needed)
│   ├── AUTONOMOUS_MODE.md           # Autonomous operation rules (NO CHANGES NEEDED)
│   ├── context-manager.json         # Context loading and file mappings
│   ├── detect-state.py              # State detection script (NO CHANGES NEEDED)
│   ├── QUICK_START.md              # User guide (minimal changes)
│   ├── workflow-tracker.json       # Workflow progress tracking
│   └── project-state.json          # Current project state (GENERATED AUTOMATICALLY)
├── README.md                        # Your main project documentation
└── [your project files]
```

---

## 🎯 Step-by-Step Setup Process

### Step 1: Understand Your Project Architecture

Before filling templates, document:
- **Services/Components**: What are the main parts of your system?
- **Dependencies**: Which components depend on others?
- **Workflows**: What are the main user workflows or processes?
- **Tech Stack**: What technologies will be used?
- **Project Phases**: How should development be sequenced?

### Step 2: Fill Out `agent-roles.json`

**Purpose**: Define what types of AI agents will work on your project and their responsibilities.

#### Customization Points:

1. **Keep or Remove Agent Types**:
   - Review the default agent roles (architect, service_developer, infrastructure_developer, etc.)
   - Remove any that don't apply to your project
   - Add new specialized roles if needed

2. **Define Service Specializations** (for service_developer):
   ```json
   "specializations": {
     "your_specialist_name": {
       "services": ["service1", "service2", "service3"],
       "focus": "Description of what this specialist handles"
     }
   }
   ```

3. **Update Service Lists**:
   - In each agent role, update `services` array or `capabilities` to match your project

**Example Customization**:
```json
// For a mobile app project:
"agent_roles": {
  "architect": { ... },
  "mobile_developer": {
    "role": "Mobile Developer",
    "primary_responsibility": "Implement mobile app screens and features",
    "specializations": {
      "ui_specialist": {
        "services": ["auth_screen", "home_screen", "profile_screen"],
        "focus": "User interface screens"
      },
      "api_specialist": {
        "services": ["api_client", "data_sync", "offline_manager"],
        "focus": "Backend integration"
      }
    }
  }
}
```

### Step 3: Fill Out `context-manager.json`

**Purpose**: Define how AI agents understand your project structure and load context.

#### Critical Sections to Customize:

1. **File Context Mapping**:

For each important file/pattern in your project, add an entry:

```json
"your_file_pattern": {
  "purpose": "What this file/type represents",
  "required_for": ["agent_types that need this"],
  "provides_context_for": ["What info it contains"],
  "next_steps_when_reading": [
    "Action 1 to take after reading",
    "Action 2 to take after reading"
  ],
  "agent_actions": {
    "agent_name": "What this agent does with this file"
  }
}
```

**Example for a Web App**:
```json
"components/{component_name}/index.tsx": {
  "purpose": "React component implementation",
  "required_for": ["frontend_developer"],
  "provides_context_for": ["Component props", "State management", "API calls"],
  "next_steps_when_reading": [
    "Check if component is complete or needs work",
    "Verify prop types are defined",
    "Check for unit tests",
    "Update project-state.json completion status"
  ],
  "agent_actions": {
    "frontend_developer": "Implement missing features, add tests, update project-state.json"
  }
}
```

2. **Automatic Context Loading Rules**:

Update the `automatic_context_loading.rules` section to match your project structure:

```json
{
  "trigger": "Pattern that triggers context loading",
  "load": [
    "Files to automatically load when pattern is matched"
  ]
}
```

### Step 4: Fill Out `workflow-tracker.json`

**Purpose**: Define the main workflows/processes in your system.

#### Structure:

```json
"workflows": {
  "your_workflow_name": {
    "name": "Descriptive Workflow Name",
    "description": "Step1 -> Step2 -> Step3",
    "status": "not_started",
    "progress_percentage": 0,
    "steps": [
      {
        "step_number": 1,
        "service": "which_component_handles_this",
        "action": "what_action_is_performed",
        "output": "what_data_is_produced",
        "status": "not_started",
        "implementation_status": "pending",
        "files": [],
        "dependencies": [],
        "event_triggers": ["event.names"],
        "event_handlers_needed": ["handler_function_names"]
      }
    ]
  }
}
```

#### How to Define Workflows:

1. **List Main User Workflows**: What are the key processes users perform?
2. **Break Into Steps**: Each workflow step should:
   - Be handled by one component/service
   - Produce a clear output
   - Have clear dependencies

3. **Define Events** (if using event-driven architecture):
   - What events trigger each step?
   - What event handlers need to be implemented?

**Example for E-commerce**:
```json
"order_processing": {
  "name": "Order Processing Workflow",
  "description": "Add to Cart -> Checkout -> Payment -> Fulfillment",
  "steps": [
    {
      "step_number": 1,
      "service": "cart_service",
      "action": "add_item",
      "output": "cart_id",
      "dependencies": []
    },
    {
      "step_number": 2,
      "service": "checkout_service",
      "action": "initiate_checkout",
      "output": "checkout_session",
      "dependencies": ["step_1"]
    }
  ]
}
```

### Step 5: Create Your Project `README.md`

**Purpose**: Main project documentation that AI Architect reads first.

#### Required Sections:

```markdown
# Project Name

## System Architecture

[Describe your architecture - microservices, monolith, etc.]

## Technology Stack

- **Backend**: [frameworks, languages]
- **Frontend**: [frameworks, languages]
- **Database**: [database systems]
- **Infrastructure**: [cloud, containers, etc.]

## Service Catalog (or Component Catalog)

### Service Name 1
- **Purpose**: What it does
- **Responsibilities**: Key functions
- **Dependencies**: What it depends on
- **API Endpoints**: Key endpoints (if applicable)

### Service Name 2
[repeat]

## Development Phases

### Phase 1: Foundation (0-20%)
- [ ] Task 1
- [ ] Task 2

### Phase 2: Core Features (20-60%)
- [ ] Task 1
- [ ] Task 2

### Phase 3: Integration (60-80%)
- [ ] Task 1

### Phase 4: Finalization (80-100%)
- [ ] Task 1

## Workflows

### Workflow Name 1
1. Step 1 description
2. Step 2 description

## Getting Started (Bootstrap Section)

```python
# Bootstrap Detection
import json
from pathlib import Path

# Check if project-state.json exists
state_file = Path(".ai-agents/project-state.json")

if state_file.exists():
    # RESUME MODE
    print("Resuming development...")
    # Load state and continue
else:
    # INITIALIZE MODE
    print("Starting fresh development...")
    # Begin Phase 1
```

[Include this exact bootstrap pattern]
```

### Step 6: Initialize `project-state.json`

**Purpose**: Track current development state.

You have two options:

#### Option A: Let the AI Create It
Don't create this file. When you say "Read README.md", the AI Architect will detect it's missing and create it automatically.

#### Option B: Create Initial Template
Create a minimal version:

```json
{
  "project_metadata": {
    "project_name": "Your Project Name",
    "version": "0.1.0",
    "current_phase": "initialization",
    "progress_percentage": 0,
    "last_updated": "2025-01-01T00:00:00Z",
    "active_agent": "architect"
  },
  "services": {
    "category_name": {
      "service_name": {
        "status": "not_started",
        "completion_percentage": 0,
        "files": [],
        "dependencies": [],
        "last_updated": ""
      }
    }
  },
  "shared_libraries": {},
  "testing": {
    "unit_tests": {},
    "integration_tests": {},
    "e2e_tests": {}
  },
  "deployment": {
    "local": {},
    "staging": {},
    "production": {}
  },
  "next_recommended_tasks": [
    {
      "task": "Create project directory structure",
      "agent": "architect",
      "priority": "critical",
      "blocking": true
    }
  ]
}
```

---

## 🔧 Minimal vs Full Customization

### Minimal Customization (Quick Start)

**Files to customize**:
1. ✅ `agent-roles.json` - Update service lists only
2. ✅ `context-manager.json` - Add your file patterns to file_context_mapping
3. ✅ `workflow-tracker.json` - Define your main workflows
4. ✅ `README.md` - Write your project documentation

**Files to keep as-is**:
- ❌ `AUTONOMOUS_MODE.md` (DO NOT CHANGE)
- ❌ `detect-state.py` (DO NOT CHANGE)
- ❌ `architect-commands.md` (usually no changes needed)
- ❌ `QUICK_START.md` (optional minor changes)

### Full Customization

Customize everything based on your project's unique needs.

---

## 🚀 Using the System

### Initial Setup

1. Create `.ai-agents/` folder in your project root
2. Fill out the template files as described above
3. Create your main `README.md`

### Starting Development

Simply say to your AI assistant:

```
Read README.md
```

The AI Architect will:
1. Detect it's a fresh start (no project-state.json)
2. Read your README.md and understand the architecture
3. Load all .ai-agents configuration files
4. Begin Phase 1 of development
5. Work completely autonomously
6. Update project-state.json as it progresses

### Resuming Development

Next time you work on the project, just say:

```
Read project-state.json
```

The AI will:
1. Detect it's resuming (project-state.json exists)
2. Load current state
3. Report progress
4. Continue with next recommended tasks

---

## 📋 Validation Checklist

Before using your configuration:

### Agent Roles
- [ ] All agent types needed for your project are defined
- [ ] Service specializations match your architecture
- [ ] Each agent has appropriate capabilities listed

### Context Manager
- [ ] File patterns cover your project structure
- [ ] next_steps_when_reading are clear and actionable
- [ ] agent_actions specify what each agent should do
- [ ] Automatic context loading rules are defined

### Workflow Tracker
- [ ] All major workflows are defined
- [ ] Each workflow has clear steps with dependencies
- [ ] Event triggers and handlers are specified (if applicable)
- [ ] Saga patterns/compensation defined for complex workflows

### README.md
- [ ] Architecture clearly described
- [ ] All services/components documented
- [ ] Dependencies between services specified
- [ ] Development phases defined
- [ ] Bootstrap section included

---

## 🎯 Example: Simple Web App

Here's a minimal example for a blog application:

### agent-roles.json
```json
{
  "agent_roles": {
    "architect": { ... },
    "fullstack_developer": {
      "role": "Full Stack Developer",
      "specializations": {
        "backend": {
          "services": ["api_server", "database", "auth"],
          "focus": "Backend API and database"
        },
        "frontend": {
          "services": ["blog_ui", "admin_panel"],
          "focus": "User interfaces"
        }
      }
    }
  }
}
```

### workflow-tracker.json
```json
{
  "workflows": {
    "create_post": {
      "name": "Create Blog Post",
      "steps": [
        {
          "step_number": 1,
          "service": "blog_ui",
          "action": "submit_post_form",
          "output": "post_data"
        },
        {
          "step_number": 2,
          "service": "api_server",
          "action": "create_post",
          "output": "post_id"
        },
        {
          "step_number": 3,
          "service": "database",
          "action": "store_post",
          "output": "success"
        }
      ]
    }
  }
}
```

---

## 🐛 Troubleshooting

### AI Agent Asks for Input
**Problem**: AI asks "Would you like me to..." instead of executing
**Solution**: Check that AUTONOMOUS_MODE.md is present and unchanged

### AI Can't Resume Work
**Problem**: AI doesn't know what to do next
**Solution**: Ensure project-state.json has `next_recommended_tasks` populated

### AI Implements Wrong Component
**Problem**: AI works on service A when service B was needed
**Solution**: Check dependencies in project-state.json and workflow-tracker.json

### AI Doesn't Load Context
**Problem**: AI seems to lack information
**Solution**: Verify context-manager.json file_context_mapping includes your file patterns

---

## 💡 Best Practices

1. **Start Simple**: Begin with minimal customization, add complexity as needed
2. **Clear Dependencies**: Always specify what depends on what
3. **Descriptive Names**: Use clear, descriptive names for services, workflows, and steps
4. **Test Bootstrap**: Test that "Read README.md" works correctly
5. **Regular Updates**: As your project evolves, update the configuration files
6. **Trust Autonomous Mode**: Let the AI work without interruption
7. **Check Progress**: Periodically check project-state.json to monitor progress

---

## 📚 Advanced Topics

### Adding Custom Agent Types

If you need a specialized agent not in the default list:

```json
"custom_agent_name": {
  "role": "Custom Agent Role",
  "primary_responsibility": "What this agent does",
  "capabilities": [
    "Capability 1",
    "Capability 2"
  ],
  "command_access": ["Commands", "This", "Agent", "Can", "Use"],
  "context_required": ["Files", "Agent", "Needs"]
}
```

### Multiple Workflows

You can define as many workflows as needed. The AI will implement them based on:
- Dependencies (some workflows need others complete first)
- Priority (marked in project-state.json)
- Service availability (services must exist before workflow can be implemented)

### Event-Driven Architectures

If your system uses events:
1. Define all events in workflow-tracker.json under `event_handlers`
2. Specify which services subscribe to which events
3. List event handlers that need implementation

### Custom Deployment Strategies

Add deployment configurations in context-manager.json:
```json
"infrastructure/kubernetes/*.yaml": {
  "purpose": "Kubernetes deployment configs",
  "required_for": ["devops_engineer"],
  "next_steps_when_reading": [
    "Update service deployments",
    "Configure ingress rules"
  ]
}
```

---

## 🎓 Learning from Examples

The templates provided were created from a microservices resume optimization project. 

**To adapt for your project**:
1. Replace "resume", "ATS", "template" concepts with your domain
2. Replace "microservices" with your architecture (monolith, serverless, etc.)
3. Keep the same structure and patterns
4. Maintain the autonomous operation philosophy

---

## ✅ Summary

**Required Files**:
- `agent-roles.json` - Define agents and their capabilities
- `context-manager.json` - Define how agents understand your project
- `workflow-tracker.json` - Define workflows and their implementation status
- `README.md` - Your project documentation (in root, not .ai-agents)
- `AUTONOMOUS_MODE.md` - Copy as-is, no changes
- `detect-state.py` - Copy as-is, no changes

**Optional Files**:
- `project-state.json` - Will be generated if missing
- `architect-commands.md` - Reference documentation
- `QUICK_START.md` - User guide

**The Magic Command**:
```
Read README.md
```

That's all you need to start autonomous development! 🚀
