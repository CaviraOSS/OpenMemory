# Quick Start Guide - AI Autonomous Development System

## ⚠️ First Time Here?

**If you're a fresh AI agent, read the root `README.md` first!**

It has a bootstrap section that automatically detects if you're:
- Starting fresh (initialize mode)
- Resuming work (resume mode)

**Only read this file if you've already executed the bootstrap protocol.**

---

## For the AI Architect

### The One Command You Need to Know

```
Read {filename}
```

That's it! Everything else is automatic.

### Bootstrap Protocol (Automatic)

Before any work, the system automatically:
1. Checks if `.ai-agents/project-state.json` exists
2. Determines: INITIALIZE mode or RESUME mode
3. Loads appropriate context
4. Guides next steps

---

## Common Usage Scenarios

### 📋 Scenario 1: Starting Fresh (0% Complete)

```
User: "Read README.md"
```

**What Happens:**
- ✅ System analyzes architecture
- ✅ Creates directory structure
- ✅ Plans implementation order
- ✅ Starts with Phase 1
- ✅ Reports: "Created project structure. Next: Implementing components..."

---

### 🔄 Scenario 2: Daily Resume (Project Partially Complete)

```
User: "Read project-state.json"
```

**What Happens:**
- ✅ Shows comprehensive status report
- ✅ Lists completed components
- ✅ Shows components in progress
- ✅ Identifies next priority tasks
- ✅ Reports blockers (if any)
- ✅ Suggests what to work on next

**Example Output:**
```
Project Status: 42% Complete

Completed:
✓ Component A
✓ Component B
✓ Component C

In Progress:
→ Component D (75%)
→ Component E (60%)

Ready to Start (Dependencies Met):
• Component F
• Component G

Blocked (Dependencies Not Met):
⛔ Component H (needs Component D)

Next Recommended:
1. Complete Component D (high priority)
2. Complete Component E (high priority)
3. Start Component F (can run in parallel)
```

---

### 🔨 Scenario 3: Working on Specific Component

```
User: "Read [path to component file]"
```

**What Happens:**
- ✅ Loads component code
- ✅ Checks component status in project-state.json
- ✅ Verifies dependencies are complete
- ✅ Analyzes what's implemented vs. what's missing
- ✅ Implements missing features
- ✅ Adds tests
- ✅ Updates project-state.json
- ✅ Reports progress

---

### 🌊 Scenario 4: Checking Workflow Status

```
User: "Read workflow-tracker.json"
```

**What Happens:**
- ✅ Shows all workflows and their status
- ✅ Identifies next implementable workflow step
- ✅ Implements the step
- ✅ Updates workflow-tracker.json
- ✅ Reports progress

---

### 🗂️ Scenario 5: Infrastructure Work

```
User: "Read [path to infrastructure/config file]"
```

**What Happens:**
- ✅ Analyzes current configuration
- ✅ Checks which components are implemented
- ✅ Adds configurations for new components
- ✅ Updates settings
- ✅ Reports ready for deployment

---

## The Automatic Context System

When you read any file, related files are automatically loaded:

### Always Loaded
- `project-state.json` (current status)
- `README.md` (architecture reference)

### Component Files → Also Loads
- Component dependencies status
- `workflow-tracker.json`
- Related configuration files

### Configuration Files → Also Loads
- All component configurations
- Deployment status

### Test Files → Also Loads
- Corresponding component implementation
- Test coverage status

---

## Decision Tree: What to Read When

```
┌─────────────────────────────────────┐
│ What do you want to do?            │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
    Get Status    Do Work
        │             │
        ↓             ↓
   Read           What kind?
   project-       ┌───┴───┐
   state.json     │       │
              Component Infrastructure
                  │       │
                  ↓       ↓
              Read        Read
              component   config
              file        file
```

---

## Status Indicators

### Component Status
- `not_started` - Not yet begun
- `in_progress` - Currently being worked on
- `completed` - Fully implemented and tested

### Phase Status
- `not_started` - Phase not begun
- `in_progress` - Some components complete
- `completed` - All components in phase done

### Progress Percentages
- `0%` - Not started
- `1-99%` - In progress
- `100%` - Complete

---

## File Modification Rules

### ✅ You CAN Manually Edit:
- `project-state.json` (to fix inconsistencies)
- `workflow-tracker.json` (to update status)

### ⚠️ DON'T Edit (System Manages):
- `context-manager.json` (defines system behavior)
- `agent-roles.json` (defines agent capabilities)

### 📖 READ ONLY:
- `README.md` (main documentation)
- `architect-commands.md` (reference)
- `AUTONOMOUS_MODE.md` (critical rules)

---

## Typical Development Session

```
1. Start
   User: "Read project-state.json"
   AI: Reports status, suggests next task

2. Work on Suggested Task
   User: "Read [component file]"
   AI: Implements features, updates state

3. Check Workflow Progress
   User: "Read workflow-tracker.json"
   AI: Shows workflow status, implements next step

4. Continue with Next Component
   User: "Read project-state.json"
   AI: Suggests next priority

5. Repeat until 100% complete
```

---

## Progress Tracking

### Check Overall Progress
```
Read project-state.json
→ See: current_phase and progress_percentage
```

### Check Specific Component
```
Read [component file path]
→ See: completion_percentage for that component
```

### Check Workflow Progress
```
Read workflow-tracker.json
→ See: progress_percentage for each workflow
```

---

## Dependency Management

### System Automatically:
✅ Checks dependencies before starting work
✅ Blocks components that need incomplete dependencies
✅ Suggests alternative tasks if blocked
✅ Updates next_recommended_tasks based on what's ready

### You Don't Need To:
❌ Track dependencies manually
❌ Check if dependencies are complete
❌ Figure out what to do next
❌ Update state files (automatic)

---

## Tips for Success

### ✨ Tip 1: Trust the System
Let `next_recommended_tasks` guide you - they're always dependency-aware and prioritized.

### ✨ Tip 2: Read Before You Work
Always start with a Read command. The system determines what needs to be done.

### ✨ Tip 3: Check Status Regularly
Periodically `Read project-state.json` to see overall progress.

### ✨ Tip 4: One Step at a Time
Let the system complete one task before moving to the next.

### ✨ Tip 5: Review the Output
The system reports what it did - review to stay informed.

---

## Error Recovery

### If Something Seems Wrong

```
1. Read project-state.json
2. Verify component statuses match reality
3. Manually update if needed
4. Continue with Read command
```

### If Dependency Issues

```
1. Read README.md
2. Check component catalog for dependencies
3. Verify dependencies in project-state.json
4. Work on dependencies first
```

### If Workflow Stuck

```
1. Read workflow-tracker.json
2. Check which components are needed
3. Complete required components
4. Resume workflow
```

---

## The Ultimate Cheat Sheet

| I Want To... | Command |
|-------------|---------|
| See overall status | `Read project-state.json` |
| Start fresh project | `Read README.md` |
| Work on component | `Read [path to component file]` |
| Check workflows | `Read workflow-tracker.json` |
| Update deployment | `Read [path to config file]` |
| Understand system | `Read .ai-agents/README.md` |

---

## Remember

### The System is Smart
- Loads context automatically
- Checks dependencies
- Determines next steps
- Updates state
- Reports progress

### You Just Need One Command
```
Read {filename}
```

### Everything Else is Automatic
The system handles:
- Context loading ✓
- Dependency checking ✓
- Task determination ✓
- Implementation ✓
- State updates ✓
- Progress tracking ✓

---

## Start Now!

```
User: "Read README.md"
```

Let the AI Architect take it from there! 🚀
