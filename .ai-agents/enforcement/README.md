# AI Agent Enforcement System

## Overview

The **AI Agent Enforcement System** ensures that AI agents **cannot bypass** or ignore the OpenMemory long-term memory system and the `.ai-agents` autonomous development system. This is achieved through **persistent, multi-layer enforcement** that validates and monitors all AI agent actions automatically.

## ⚠️ Critical: This Is Not Optional

AI agents working on this project **MUST** use these systems. The enforcement mechanisms are:

- **Automatic** - Initialized when the project starts
- **Persistent** - Runs continuously via watchdog service
- **Mandatory** - API-level validation prevents bypass
- **Comprehensive** - Validates actions, dependencies, schemas, and compliance

## Architecture

The enforcement system consists of **5 layers** that work together:

### Layer 1: Automatic Initialization
**File**: `.ai-agents/enforcement/auto-init.ts`

Runs when the project starts to:
- Verify `.ai-agents` directory and configuration
- Check OpenMemory connection
- Load or initialize project state
- Verify enforcement is operational
- Create status files for monitoring

### Layer 2: API Middleware Enforcement
**File**: `backend/src/server/middleware/ai-agent-enforcement.ts`

Intercepts **ALL** AI agent API calls and validates:
- ✅ Project name is provided
- ✅ Agent name is provided
- ✅ OpenMemory is being used
- ✅ Task dependencies are satisfied
- ✅ Request matches required schemas
- ✅ No autonomous mode violations

**Blocked requests return HTTP 403 with violation details.**

### Layer 3: Persistent Watchdog Service
**File**: `.ai-agents/enforcement/watchdog.ts`

Runs continuously (every 5 minutes) to monitor:
- ✅ OpenMemory health
- ✅ Enforcement middleware status
- ✅ Recent agent activity
- ✅ Consistency validation
- ✅ Anomaly detection
- ✅ Autonomous mode compliance

**Violations are logged and reported.**

### Layer 4: Schema Validation
**File**: `.ai-agents/enforcement/schemas.ts`

Defines strict schemas for:
- Recording actions (ActionSchema)
- Recording decisions (DecisionSchema)
- Recording patterns (PatternSchema)
- Updating state (StateSchema)
- Recording emotions (EmotionSchema)

**Invalid data is rejected at the API level.**

### Layer 5: Validation Endpoints
**File**: `backend/src/server/routes/ai-agents.ts`

16+ validation endpoints that are called automatically:
- `/ai-agents/validate/consistency/:project_name` - Detect contradictions
- `/ai-agents/validate/effectiveness/:project_name` - Track pattern success
- `/ai-agents/validate/decisions/:project_name` - Assess decision quality
- `/ai-agents/analyze/failures/:project_name` - Learn from failures
- `/ai-agents/detect/conflicts/:project_name` - Proactive conflict detection
- `/ai-agents/detect/anomalies/:project_name` - Anomaly detection
- And 10+ more...

## How It Works

### On Project Startup

1. **Startup script** (`.ai-agents/enforcement/startup.sh`) runs:
   - Verifies system is properly configured
   - Creates enforcement status file
   - Checks OpenMemory availability

2. **OpenMemory server starts** and automatically:
   - Loads enforcement middleware
   - Starts watchdog service
   - Enables all validation endpoints

3. **AI agents** can now work, but:
   - All actions are validated
   - All state must go through OpenMemory
   - All requirements are enforced

### During AI Agent Operation

```
AI Agent Action
       ↓
API Middleware Intercepts
       ↓
Validates:
  • Project name provided?
  • Agent name provided?
  • OpenMemory being used?
  • Dependencies satisfied?
  • Schema valid?
  • Autonomous mode compliant?
       ↓
    [PASS] → Action executed → Recorded in OpenMemory
       ↓
    [FAIL] → HTTP 403 returned → Action blocked
```

### Continuous Monitoring

Every 5 minutes, the watchdog:
1. Checks OpenMemory health
2. Verifies enforcement is active
3. Validates recent activity
4. Runs consistency checks
5. Detects anomalies
6. Logs compliance report

## What AI Agents Cannot Do

❌ **Cannot bypass OpenMemory** - Middleware requires it
❌ **Cannot skip recording actions** - Schema validation enforces it
❌ **Cannot ignore task dependencies** - Validation checks prevent it
❌ **Cannot violate autonomous mode** - Warnings are issued
❌ **Cannot work without validation** - All endpoints are protected

## What AI Agents Must Do

✅ **Must provide project_name** for all operations
✅ **Must provide agent_name** for all operations
✅ **Must record all actions** in OpenMemory
✅ **Must record all decisions** with rationale
✅ **Must store all patterns** with descriptions
✅ **Must update project state** regularly
✅ **Must follow autonomous mode** requirements
✅ **Must complete dependencies** before new tasks

## API Endpoints

### Enforcement Monitoring

```bash
# Check enforcement system health
GET /ai-agents/enforcement/health

# Get enforcement statistics for a project
GET /ai-agents/enforcement/stats/:project_name

# Get active resource locks
GET /ai-agents/enforcement/locks
```

### Example Response

```json
{
  "success": true,
  "status": "operational",
  "config": {
    "requireOpenMemory": true,
    "validateTaskDependencies": true,
    "enableActionLocking": true,
    "validateSchemas": true,
    "strictMode": true
  },
  "uptime": 3600
}
```

## Violation Handling

When an AI agent violates enforcement rules:

### HTTP 403 Response
```json
{
  "error": "AI_AGENT_ENFORCEMENT_VIOLATION",
  "message": "Action blocked by enforcement system",
  "violations": [
    "Project name is required for all AI agent actions",
    "No OpenMemory records found for project \"MyProject\""
  ],
  "warnings": [
    "Action description contains question - agents should report what they DID"
  ],
  "help": "AI agents must follow autonomous operation requirements. See .ai-agents/COPY_AS_IS_AUTONOMOUS_MODE.md"
}
```

### HTTP 423 Response (Resource Locked)
```json
{
  "error": "RESOURCE_LOCKED",
  "message": "Task \"implement-auth-service\" is locked by agent \"backend-agent\"",
  "locked_by": "backend-agent"
}
```

## Configuration

The enforcement system is configured via:

### `.ai-agents/config.json`
```json
{
  "openmemory": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "fallback_to_local": true
  },
  "agent_config": {
    "record_actions": true,
    "record_decisions": true,
    "store_patterns": true
  }
}
```

### Environment Variables
```bash
OPENMEMORY_URL=http://localhost:8080  # OpenMemory server URL
```

## File Structure

```
.ai-agents/
├── enforcement/
│   ├── README.md                    # This file
│   ├── auto-init.ts                 # Automatic initialization
│   ├── watchdog.ts                  # Persistent monitoring
│   ├── schemas.ts                   # Schema definitions
│   ├── startup.sh                   # Startup script
│   └── watchdog.log                 # Watchdog logs
├── enforcement-status.json          # Current status (auto-generated)
├── config.json                      # Configuration
└── COPY_AS_IS_AUTONOMOUS_MODE.md    # Autonomous mode requirements

backend/src/server/
└── middleware/
    └── ai-agent-enforcement.ts      # API middleware
```

## Logs and Monitoring

### Watchdog Logs
Location: `.ai-agents/enforcement/watchdog.log`

Each line is a JSON report:
```json
{
  "timestamp": "2025-11-05T10:30:00Z",
  "checks_passed": 6,
  "checks_failed": 0,
  "violations": [],
  "warnings": [],
  "recommendations": []
}
```

### Enforcement Status
Location: `.ai-agents/enforcement-status.json`

Auto-generated file showing current status:
```json
{
  "timestamp": "2025-11-05T10:30:00Z",
  "enforcement_active": true,
  "mode": "RESUME",
  "errors": [],
  "warnings": [],
  "requirements": {
    "use_openmemory": true,
    "record_all_actions": true,
    "follow_autonomous_mode": true,
    "validate_dependencies": true,
    "cannot_bypass": true
  }
}
```

## Troubleshooting

### Problem: Enforcement middleware not active

**Solution**: Ensure OpenMemory backend is running:
```bash
cd backend
npm run dev
```

The middleware loads automatically on server start.

### Problem: OpenMemory connection failed

**Solution**: Check that OpenMemory is running and accessible:
```bash
curl http://localhost:8080/health
```

If fallback is enabled in config, local files will be used.

### Problem: Actions being blocked unexpectedly

**Solution**: Check the violation details in the HTTP 403 response. Common issues:
- Missing required fields (project_name, agent_name, etc.)
- Invalid data in request body
- Dependencies not completed
- Schema validation failures

### Problem: Watchdog not running

**Solution**: The watchdog starts automatically with the OpenMemory server. Check server logs:
```bash
# Should see:
# [AI Agent Enforcement] Starting watchdog service...
# [Watchdog] Starting...
```

## Integration Testing

Test the enforcement system:

```bash
# 1. Start OpenMemory
cd backend
npm run dev

# 2. Check enforcement health
curl http://localhost:8080/ai-agents/enforcement/health

# 3. Try to create action without project_name (should fail)
curl -X POST http://localhost:8080/ai-agents/action \
  -H "Content-Type: application/json" \
  -d '{"agent_name": "test", "action": "test"}'

# Expected: HTTP 403 with violation details

# 4. Create valid action (should succeed)
curl -X POST http://localhost:8080/ai-agents/action \
  -H "Content-Type: application/json" \
  -d '{
    "project_name": "OpenMemory",
    "agent_name": "test-agent",
    "action": "Created test action",
    "context": "Integration testing"
  }'

# Expected: HTTP 200 with success
```

## For AI Agents Reading This

If you're an AI agent working on this project:

1. **Read enforcement-status.json** to verify enforcement is active
2. **Always provide project_name and agent_name** in all API calls
3. **Record every action** you take using `/ai-agents/action`
4. **Record all decisions** with rationale using `/ai-agents/decision`
5. **Store patterns** you discover using `/ai-agents/pattern`
6. **Update project state** regularly using `/ai-agents/state`
7. **Follow AUTONOMOUS_MODE.md** - no asking for confirmation
8. **Check dependencies** before starting tasks
9. **Use past tense** in action descriptions (what you DID, not what you WILL do)

**You cannot bypass these requirements.** The system will block any attempts to work without proper validation and recording.

## Summary

The AI Agent Enforcement System ensures persistent, mandatory compliance through:

- ✅ **Automatic initialization** on project startup
- ✅ **API-level validation** that cannot be bypassed
- ✅ **Continuous monitoring** via watchdog service
- ✅ **Schema validation** for data integrity
- ✅ **Resource locking** to prevent conflicts
- ✅ **Comprehensive logging** for auditing

This system makes it **impossible** for AI agents to ignore OpenMemory and the `.ai-agents` system, ensuring consistent, trackable, autonomous development.
