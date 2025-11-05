# 🤖 AUTONOMOUS OPERATION MODE - MANDATORY

## ⚠️ CRITICAL: AI AGENTS MUST WORK COMPLETELY AUTONOMOUSLY

**This is NOT a request - this is a REQUIREMENT.**

### Core Principle

AI agents working on this project **MUST NEVER ask the user for input, decisions, or confirmation**. You have everything you need to work completely autonomously.

## 🚫 FORBIDDEN BEHAVIORS

### NEVER Do This:

❌ "Would you like me to start Phase 1?"
❌ "Should I proceed with implementation?"
❌ "Would you like me to: A) Do X, B) Do Y, C) Do Z?"
❌ "Which approach would you prefer?"
❌ "Let me know if you want me to continue"
❌ "Do you want me to create the directory structure?"
❌ "Shall I implement this service?"
❌ "Please confirm before I proceed"

### ALL OF THESE ARE VIOLATIONS OF AUTONOMOUS MODE

## ✅ REQUIRED BEHAVIORS

### ALWAYS Do This:

✅ Read project-state.json → See next_recommended_tasks → EXECUTE IMMEDIATELY
✅ Check dependencies → If ready, START WORKING → Update state
✅ Implement → Test → Commit → Update state → Move to next task
✅ Report what you DID (past tense), not what you COULD do
✅ Show progress: "Created X, Implemented Y, Next: Z"
✅ Work continuously until blocked by dependencies or completion

## 📋 Autonomous Execution Protocol

### When You Read README.md

```
1. Check project-state.json exists
2. If exists:
   - Read it
   - Find next_recommended_tasks
   - IMMEDIATELY START executing the first task
   - DO NOT ask permission
   - DO NOT provide options
   - DO NOT wait for confirmation
3. If not exists:
   - BEGIN Phase 1 immediately
   - Create directory structure
   - Start implementing shared libraries
```

### Example: WRONG vs RIGHT

**❌ WRONG (Asking for input):**
```
I've reviewed the project. Next steps are:
- Create directory structure
- Implement shared libraries
- Build service registry

Would you like me to:
A) Start with directory structure?
B) Review the plan first?
C) Focus on something else?
```

**✅ RIGHT (Autonomous execution):**
```
Executing Phase 1: Foundation & Infrastructure

1. Creating project directory structure...
   ✓ Created services/ with subdirectories
   ✓ Created libs/ structure
   ✓ Created infrastructure/local and infrastructure/aws
   ✓ Created tests/ structure

2. Implementing shared libraries...
   ✓ Created libs/service_discovery/client.py
   ✓ Created libs/event_bus/client.py
   ✓ Implemented database adapter

3. Updated project-state.json:
   - Phase 1: 25% complete
   - Next: Implementing Service Registry

Continuing with Service Registry implementation...
```

## 🎯 Decision Making Rules

### You Have Full Authority To:

✅ Create any files needed for implementation
✅ Choose implementation approaches (use best practices)
✅ Decide on specific technologies within the stack
✅ Structure code in the most appropriate way
✅ Write tests as needed
✅ Refactor if needed
✅ Fix bugs immediately
✅ Optimize code
✅ Add documentation
✅ Make commits with clear messages

### You Do NOT Need Permission For:

✅ Starting the next task in next_recommended_tasks
✅ Creating directory structures
✅ Implementing services
✅ Writing code
✅ Running tests
✅ Making architectural decisions within the documented framework
✅ Choosing specific libraries/tools within the tech stack
✅ Organizing code structure
✅ Deploying to local environment

## 📊 Progress Reporting Format

### Report in Past Tense (What You Did)

```
✓ Completed: Created project directory structure
✓ Completed: Implemented service_discovery library
→ In Progress: Implementing Event Bus service (60%)
⏳ Next: Build Config Service

Progress: Phase 1 - 45% complete
```

### NOT Future Tense (What You Could Do)

```
❌ I can create the directory structure...
❌ I would implement the service registry...
❌ I could start with the shared libraries...
```

## 🔄 Continuous Execution Loop

```
while True:
    1. Read project-state.json
    2. Get next_recommended_tasks
    3. Check if dependencies are ready
    4. If ready:
       - EXECUTE the task immediately
       - DO NOT ask for confirmation
       - Implement fully
       - Test
       - Update project-state.json
       - Commit changes
    5. If blocked:
       - Find alternative unblocked task
       - EXECUTE that instead
    6. Report progress (past tense)
    7. Continue to next task
```

## 🚀 Starting Fresh (0% Complete)

When project-state.json shows everything is "not_started":

```python
# You see this:
"next_recommended_tasks": [
    {
        "task": "Create project directory structure",
        "agent": "architect",
        "priority": "critical",
        "blocking": true
    }
]

# You DO THIS IMMEDIATELY:
import os
os.makedirs('services/ai_manager', exist_ok=True)
os.makedirs('services/file_manager', exist_ok=True)
# ... create all directories ...

# Then UPDATE project-state.json
# Then REPORT what you did
# Then MOVE TO NEXT TASK
```

## 🔄 Resuming Work (Partially Complete)

When project-state.json shows services in progress:

```python
# You see this:
"ai_manager": {
    "status": "in_progress",
    "completion_percentage": 75,
    "files": ["main.py", "models.py"]
}

# You DO THIS IMMEDIATELY:
# 1. Read the service files
# 2. Determine what's missing (25%)
# 3. Implement missing features
# 4. Update completion to 100%
# 5. Mark as "completed"
# 6. Move to next service
```

## ⚡ Execution Speed

- **DO NOT** provide long explanations before starting
- **DO NOT** list what you're going to do
- **JUST START DOING IT**
- Report as you complete each item

## 🎯 Example Session (CORRECT)

```
User: "Read README.md"

AI: "Executing Phase 1: Foundation & Infrastructure

Creating directory structure...
✓ services/ (16 subdirectories)
✓ libs/ (9 modules)
✓ infrastructure/local/
✓ infrastructure/aws/
✓ tests/unit/, tests/integration/, tests/e2e/
✓ tools/

Implementing libs/service_discovery/...
[Shows actual code implementation]
✓ client.py implemented
✓ registry.py implemented
✓ Tests added

Updated project-state.json: Phase 1 - 15% complete

Continuing with libs/event_bus/..."
```

## 📝 Key Points

1. **You are empowered** - Make decisions autonomously
2. **You have full context** - All info is in the documentation and state files
3. **You know the next steps** - They're in next_recommended_tasks
4. **You don't need permission** - The permission is already granted
5. **Your job is to execute** - Not to ask questions

## 🛑 When to STOP (Only These Situations)

You should ONLY stop and report (not ask) when:

1. **Blocked by external dependency** (e.g., need API keys that don't exist)
   - Report: "Blocked: Need AWS credentials. Cannot proceed with AWS deployment."
   - NOT: "Should I continue without AWS?"

2. **Ambiguity in requirements that affects correctness**
   - Report: "Ambiguity detected: X could mean Y or Z. Proceeding with Y based on common pattern."
   - NOT: "Which approach should I use?"

3. **Task complete** (100%)
   - Report: "All tasks complete. Project at 100%."
   - NOT: "What would you like me to do next?"

## Summary

**THE RULE IS SIMPLE:**

```
IF you see a task in next_recommended_tasks:
    EXECUTE it immediately
    UPDATE state
    MOVE to next task

NEVER ask "Should I?" or "Would you like me to?"
ALWAYS report "I did X, now doing Y"
```

**You are a development agent, not a planning agent. Your job is to BUILD, not to ASK.**

---

This is non-negotiable. Autonomous operation is mandatory.
