# AI Agent System - Setup Checklist

## 📋 Complete Setup Guide

Use this checklist to ensure your AI Agent system is properly configured for your project.

---

## ✅ Phase 1: Project Analysis (Before You Start)

Before filling out any templates, answer these questions about your project:

### Architecture Questions
- [ ] What type of architecture? (microservices, monolith, modular, serverless)
- [ ] How many main components/services? (List them)
- [ ] Which components depend on which others? (Draw dependency graph)

### Technology Questions
- [ ] Backend language(s): __________________
- [ ] Backend framework(s): __________________
- [ ] Database(s): __________________
- [ ] Frontend (if applicable): __________________
- [ ] Deployment strategy: __________________

### Workflow Questions
- [ ] What are the 3-5 main user workflows? (List them)
- [ ] What are the steps in each workflow? (Break them down)

### Complexity Assessment
- [ ] Simple (1-5 components, monolith): → Use minimal configuration
- [ ] Medium (5-15 components, modular): → Use recommended configuration
- [ ] Complex (15+ components, microservices): → Use full configuration

---

## ✅ Phase 2: Directory Setup

### Step 1: Create Directory Structure

```bash
cd your-project-root/
mkdir .ai-agents
cd .ai-agents
```

### Step 2: Copy Required Files

**Copy these files AS-IS (no modifications needed):**
```bash
# Copy to .ai-agents/ directory:
- COPY_AS_IS_AUTONOMOUS_MODE.md → AUTONOMOUS_MODE.md
- COPY_AS_IS_detect-state.py → detect-state.py
- COPY_AS_IS_architect-commands.md → architect-commands.md
- COPY_AS_IS_QUICK_START.md → QUICK_START.md
```

**Copy these TEMPLATES (need customization):**
```bash
# Copy to .ai-agents/ directory:
- TEMPLATE_agent-roles.json → agent-roles.json (CUSTOMIZE)
- TEMPLATE_context-manager.json → context-manager.json (CUSTOMIZE)
- TEMPLATE_workflow-tracker.json → workflow-tracker.json (CUSTOMIZE)
- TEMPLATE_project-state.json → project-state.json (OPTIONAL - can be auto-generated)

# Copy to project root (not .ai-agents):
- TEMPLATE_README.md → README.md (CUSTOMIZE for your project)
```

**Verification:**
```bash
# Your structure should look like:
your-project/
├── .ai-agents/
│   ├── AUTONOMOUS_MODE.md           ✓ No changes needed
│   ├── detect-state.py              ✓ No changes needed
│   ├── architect-commands.md        ✓ No changes needed
│   ├── QUICK_START.md              ✓ No changes needed
│   ├── agent-roles.json            ⚠️  NEEDS CUSTOMIZATION
│   ├── context-manager.json        ⚠️  NEEDS CUSTOMIZATION
│   ├── workflow-tracker.json       ⚠️  NEEDS CUSTOMIZATION
│   └── project-state.json          📝 Optional (auto-generated)
└── README.md                        ⚠️  NEEDS CUSTOMIZATION
```

---

## ✅ Phase 3: Customize agent-roles.json

Open `.ai-agents/agent-roles.json`

### Step 1: Remove Unused Agent Types
- [ ] Remove agent types you won't need (e.g., remove `security_engineer` if not needed)
- [ ] Keep at least: `architect`, a developer role, `qa_engineer`

### Step 2: Customize Developer Role(s)
- [ ] Rename `TEMPLATE_DEVELOPER_ROLE` to match your project (e.g., `fullstack_developer`, `mobile_developer`)
- [ ] Update the `role` field description
- [ ] Update `capabilities` to match your tech stack

### Step 3: Define Specializations
- [ ] In `specializations`, replace `TEMPLATE_SPECIALIST_1` with your actual specializations
- [ ] Update the `services` array with your component names
- [ ] Update `focus` descriptions

**Example Transformation:**
```json
// BEFORE (Template):
"TEMPLATE_SPECIALIST_1": {
  "services": ["component1", "component2"],
  "focus": "Description"
}

// AFTER (Your Project):
"backend_api": {
  "services": ["auth_api", "user_api", "order_api"],
  "focus": "Backend API endpoints and business logic"
}
```

### Step 4: Update Context Required
- [ ] Ensure `context_required` lists files relevant to each agent

**Verification Checklist:**
- [ ] All TEMPLATE markers replaced with real names
- [ ] Service names match your actual components
- [ ] Agent capabilities reflect your tech stack
- [ ] Unused agents removed

---

## ✅ Phase 4: Customize context-manager.json

Open `.ai-agents/context-manager.json`

### Step 1: Update File Context Mapping

For each major file pattern in your project:

**Pattern Template:**
```json
"your/file/pattern": {
  "purpose": "What this file/pattern represents",
  "required_for": ["which_agents_need_it"],
  "provides_context_for": ["what_info_it_contains"],
  "next_steps_when_reading": [
    "Action 1",
    "Action 2"
  ],
  "agent_actions": {
    "agent_name": "What this agent does with this file"
  }
}
```

**Common patterns to add:**

For **Backend API** projects:
```json
"src/routes/{route}.js": { ... }
"src/controllers/{controller}.js": { ... }
"src/models/{model}.js": { ... }
```

For **React/Frontend** projects:
```json
"src/components/{component}/index.tsx": { ... }
"src/pages/{page}.tsx": { ... }
"src/hooks/{hook}.ts": { ... }
```

For **Microservices**:
```json
"services/{service_name}/main.py": { ... }
"services/{service_name}/api.py": { ... }
```

For **Python Projects**:
```json
"src/{module}/{file}.py": { ... }
"lib/{library}.py": { ... }
```

### Step 2: Replace TEMPLATE Markers
- [ ] Replace all `TEMPLATE_COMPONENT_PATTERN` entries
- [ ] Replace `TEMPLATE_developer` with your actual agent names
- [ ] Update file patterns to match your project structure

### Step 3: Update Automatic Context Loading Rules
- [ ] Customize the `trigger` patterns to match your project
- [ ] Update what files should be `load`ed automatically

**Verification Checklist:**
- [ ] All major file patterns in your project are covered
- [ ] All TEMPLATE markers replaced
- [ ] Agent names match those in agent-roles.json
- [ ] next_steps_when_reading are clear and actionable

---

## ✅ Phase 5: Customize workflow-tracker.json

Open `.ai-agents/workflow-tracker.json`

### Step 1: Define Your Workflows

For each major workflow in your project:

**Workflow Template:**
```json
"workflow_name": {
  "name": "Descriptive Name",
  "description": "Step1 -> Step2 -> Step3",
  "status": "not_started",
  "progress_percentage": 0,
  "steps": [
    {
      "step_number": 1,
      "service": "which_component",
      "action": "what_action",
      "output": "what_data_produced",
      "status": "not_started",
      "implementation_status": "pending",
      "files": [],
      "dependencies": []
    }
  ]
}
```

### Step 2: Remove or Simplify
- [ ] Remove `event_handlers` section if not using events
- [ ] Remove `saga_orchestration` if not needed
- [ ] Simplify `integration_points` or remove if simple app

### Step 3: List All Workflows
- [ ] Add all 3-5 main workflows identified in Phase 1
- [ ] Break each workflow into clear steps
- [ ] Define dependencies between steps

**Example Workflows by Project Type:**

**E-commerce:**
- Product browsing → Add to cart → Checkout → Payment → Fulfillment

**SaaS App:**
- User registration → Email verification → Profile setup → Onboarding

**Content Platform:**
- Upload content → Process/validate → Analyze → Publish → Notify

**Data Pipeline:**
- Ingest data → Transform → Validate → Store → Report

### Step 4: Verify Dependencies
- [ ] Each step lists correct `dependencies` (previous steps it needs)
- [ ] `service` field matches component names from agent-roles.json

**Verification Checklist:**
- [ ] All major workflows defined
- [ ] Each workflow has clear steps
- [ ] Dependencies are accurate
- [ ] Removed unnecessary sections (events, saga, etc.) if not needed

---

## ✅ Phase 6: Create Project README.md

Open `README.md` (in project root, not .ai-agents)

### Step 1: Project Information
- [ ] Replace `TEMPLATE: Project Name` with your project name
- [ ] Add project description
- [ ] Select architecture type (check the box)

### Step 2: Technology Stack
- [ ] Fill in all technology choices
- [ ] List backend language and framework
- [ ] List database(s)
- [ ] List frontend framework (if applicable)
- [ ] List infrastructure tools

### Step 3: Component Catalog
- [ ] For each component in your project:
  - [ ] Add a section with component name
  - [ ] Describe its purpose
  - [ ] List its responsibilities
  - [ ] List its dependencies
  - [ ] Document API endpoints or interfaces

### Step 4: Workflows
- [ ] Document each workflow from workflow-tracker.json
- [ ] Describe all steps clearly
- [ ] Show which component handles each step

### Step 5: Development Phases
- [ ] Customize the phases to match your project
- [ ] List specific tasks in each phase
- [ ] Ensure tasks follow dependency order

### Step 6: Bootstrap Section
- [ ] Keep the bootstrap detection code AS-IS
- [ ] This is critical for AI agent initialization

**Verification Checklist:**
- [ ] All TEMPLATE markers replaced
- [ ] All components documented
- [ ] All workflows described
- [ ] Bootstrap section unchanged
- [ ] Dependencies clearly shown

---

## ✅ Phase 7: Optional - Create Initial project-state.json

**Option A (Recommended):** Let the AI create it automatically
- [ ] Don't create this file
- [ ] The AI will detect it's missing and create it when you run "Read README.md"

**Option B:** Create initial version manually
- [ ] Open `TEMPLATE_project-state.json`
- [ ] Update `project_name`
- [ ] Define all components in `services` section
- [ ] Set initial `next_recommended_tasks`
- [ ] Save as `.ai-agents/project-state.json`

---

## ✅ Phase 8: Validation

### Automated Validation

Run the detection script:
```bash
cd your-project-root
python .ai-agents/detect-state.py
```

**Expected Output:**
- Shows either INITIALIZE or RESUME mode
- No errors

### Manual Validation Checklist

**File Existence:**
- [ ] `.ai-agents/AUTONOMOUS_MODE.md` exists
- [ ] `.ai-agents/detect-state.py` exists
- [ ] `.ai-agents/architect-commands.md` exists
- [ ] `.ai-agents/QUICK_START.md` exists
- [ ] `.ai-agents/agent-roles.json` exists and is valid JSON
- [ ] `.ai-agents/context-manager.json` exists and is valid JSON
- [ ] `.ai-agents/workflow-tracker.json` exists and is valid JSON
- [ ] `README.md` exists in project root

**Content Validation:**
- [ ] No "TEMPLATE" text remaining in any file
- [ ] All agent names consistent across files
- [ ] All component names consistent across files
- [ ] All file patterns match your actual project structure
- [ ] Bootstrap section in README.md is unchanged

**JSON Validation:**
```bash
# Validate JSON files:
python -m json.tool .ai-agents/agent-roles.json
python -m json.tool .ai-agents/context-manager.json
python -m json.tool .ai-agents/workflow-tracker.json
```

All should output formatted JSON with no errors.

---

## ✅ Phase 9: Test Run

### First Test

In your AI assistant, run:
```
Read README.md
```

**Expected Behavior:**
1. AI detects it's initialization mode (no project-state.json)
2. AI reads README.md and understands the architecture
3. AI begins Phase 1: Creates directory structure
4. AI reports what it did (past tense)
5. AI does NOT ask "Would you like me to..."

**If AI asks for input:** Check that AUTONOMOUS_MODE.md is present and unchanged

**If AI seems confused:** Check that all TEMPLATE markers are replaced in README.md

### Second Test

After AI completes some work, run:
```
Read project-state.json
```

**Expected Behavior:**
1. AI shows status report
2. AI lists completed components
3. AI shows progress percentage
4. AI suggests next tasks
5. AI does NOT ask for permission

---

## ✅ Phase 10: Troubleshooting

### Problem: AI Asks "Would you like me to..."

**Solution:**
- Verify `.ai-agents/AUTONOMOUS_MODE.md` exists
- Ensure file is unchanged from COPY_AS_IS version
- Remind AI: "Work autonomously following AUTONOMOUS_MODE.md"

### Problem: AI Can't Find Files

**Solution:**
- Check file paths in context-manager.json match actual structure
- Verify all TEMPLATE markers replaced
- Ensure files exist where specified

### Problem: AI Implements Wrong Components

**Solution:**
- Check dependencies in README.md and project-state.json
- Verify workflow-tracker.json has correct step order
- Check agent-roles.json has correct specializations

### Problem: JSON Parsing Errors

**Solution:**
```bash
# Find the error:
python -m json.tool .ai-agents/[filename].json
# Fix the syntax error shown
```

### Problem: AI Doesn't Know What to Do Next

**Solution:**
- Ensure `next_recommended_tasks` in project-state.json is populated
- Verify README.md has clear development phases
- Check that workflow-tracker.json defines all workflows

---

## ✅ Success Criteria

Your AI Agent system is properly configured when:

- [ ] Running `Read README.md` starts autonomous development
- [ ] AI never asks for permission or confirmation
- [ ] AI reports what it DID (past tense), not what it COULD do
- [ ] AI automatically updates project-state.json after completing tasks
- [ ] AI follows dependency order (doesn't implement Component B before Component A)
- [ ] Running `Read project-state.json` shows clear status report
- [ ] AI can resume work seamlessly between sessions

---

## 📚 Quick Reference

### Files That NEVER Change
- `AUTONOMOUS_MODE.md`
- `detect-state.py`
- `architect-commands.md`
- `QUICK_START.md`

### Files That MUST Be Customized
- `agent-roles.json`
- `context-manager.json`
- `workflow-tracker.json`
- `README.md` (project root)

### File That's Auto-Generated
- `project-state.json` (created by AI on first run)

### The Magic Command
```
Read README.md
```

---

## 🎓 Learning Resources

After setup, read these for deeper understanding:
1. `AI_AGENT_SYSTEM_INSTRUCTIONS.md` - Detailed customization guide
2. `.ai-agents/architect-commands.md` - How the Read command works
3. `.ai-agents/AUTONOMOUS_MODE.md` - Why AI works autonomously

---

## ✅ Final Checklist

Before starting development:

- [ ] All files copied to correct locations
- [ ] All TEMPLATE markers replaced
- [ ] All JSON files valid (no syntax errors)
- [ ] Agent names consistent across all files
- [ ] Component names consistent across all files
- [ ] File patterns match your project structure
- [ ] Bootstrap section in README.md unchanged
- [ ] Test run successful (AI starts working autonomously)
- [ ] No "Would you like me to..." responses from AI

**If all boxes are checked: You're ready to begin autonomous development!** 🚀

---

## Next Steps

1. Run `Read README.md` in your AI assistant
2. Watch the AI work autonomously
3. Let it complete Phase 1
4. Check progress with `Read project-state.json`
5. Continue letting AI work through all phases

**Remember: Don't interrupt. Let the AI work autonomously!**
