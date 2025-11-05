# Git Hooks for AI Agent Enforcement

This directory contains git hooks that provide **true enforcement** for AI agents, including Claude Code in VS Code.

## Overview

The git pre-commit hook ensures that AI agents **cannot commit code without proper validation**, solving the critical limitation where agents with direct file system access could bypass API-level enforcement.

## The Problem This Solves

**Without git hooks:**
```
Claude Code → Directly edits files → git commit → ✓ Committed (no validation!)
```

**With git hooks:**
```
Claude Code → Directly edits files → git commit → Hook validates → ❌ BLOCKED (if invalid)
```

## Components

### 1. pre-commit Hook
**File**: `pre-commit`
**Installed to**: `.git/hooks/pre-commit`

The actual git hook that runs before every commit. It validates:
- ✅ `.ai-agents` system is present
- ✅ OpenMemory is accessible (or fallback enabled)
- ✅ Staged files are analyzed
- ✅ Recent AI agent activity is present
- ✅ State files are updated (for significant changes)
- ✅ Autonomous mode compliance (no questions, future tense, etc.)

**Execution time**: ~1-3 seconds
**Can be bypassed**: Yes, but logged (emergency only)

### 2. install-hooks.sh
**File**: `install-hooks.sh`

Installation script that:
- Copies hooks to `.git/hooks/`
- Creates required directories
- Generates config.json if missing
- Tests hook functionality
- Works for **any project**

**Usage**:
```bash
./install-hooks.sh [project-root]
```

### 3. hook-executions.log
**File**: `hook-executions.log` (auto-generated)

Logs every hook execution:
```
2025-11-05T10:30:00Z - START - Project: OpenMemory
2025-11-05T10:30:02Z - PASSED - Project: OpenMemory, Files: 5
2025-11-05T11:15:00Z - BLOCKED - Missing state file updates
2025-11-05T12:00:00Z - BYPASS - User: dev@example.com
```

## How Pre-Commit Hook Works

### Validation Steps

The hook runs **6 validation checks** before allowing a commit:

#### [1/6] Check .ai-agents System
- Verifies `.ai-agents/` directory exists
- Checks `config.json` is present
- Blocks if system is not initialized

#### [2/6] Check OpenMemory Connection
- Calls `/health` endpoint
- If OpenMemory unavailable and `fallback_to_local: false` → BLOCK
- If fallback enabled → WARN and continue

#### [3/6] Analyze Staged Changes
- Counts staged files
- Detects significant code changes (`.ts`, `.js`, `.py`, etc.)
- Differentiates code changes from docs/config

#### [4/6] Check Recent AI Agent Activity
- Queries `/ai-agents/history/:project_name`
- Looks for activity within last 30 minutes
- If no activity → WARN (doesn't block)
- Indicates actions may not have been recorded

#### [5/6] Check State File Updates
- If significant code changes detected
- Checks if `project-state.json` or similar is staged
- If missing → WARN (doesn't block in non-strict mode)

#### [6/6] Validate Autonomous Mode Compliance
- Scans commit message for violations:
  - Questions: "should i", "would you like", etc.
  - Confirmation requests: "please confirm", "need approval"
  - Asking user: "waiting for", "ask user"
- Violations → WARN (doesn't block, just logs)

### Optional: Comprehensive Validation
- If OpenMemory accessible, runs `/ai-agents/validate/consistency/:project_name`
- Checks for contradictions, circular dependencies, etc.
- Results logged but don't block commit

## What Gets Blocked vs Warned

### BLOCKED (Exit code 1 - commit fails):
- ❌ `.ai-agents` directory missing
- ❌ `config.json` missing
- ❌ OpenMemory unavailable and `fallback_to_local: false`

### WARNED (Exit code 0 - commit succeeds):
- ⚠️ No recent AI agent activity
- ⚠️ State files not updated (in non-strict mode)
- ⚠️ Autonomous mode violations in commit message
- ⚠️ Consistency issues found in validation

### Strict Mode
Set in `config.json`:
```json
{
  "enforcement": {
    "strict_mode": true
  }
}
```

In strict mode, **warnings become blocks**.

## Installation

### Automatic (Recommended)

The hook is automatically installed when you run:
```bash
./.ai-agents/enforcement/startup.sh
```

Or manually:
```bash
./.ai-agents/enforcement/git-hooks/install-hooks.sh
```

### Manual Installation

```bash
# Copy hook to git hooks directory
cp .ai-agents/enforcement/git-hooks/pre-commit .git/hooks/pre-commit

# Make executable
chmod +x .git/hooks/pre-commit

# Test
.git/hooks/pre-commit
```

### Verification

```bash
# Check hook is installed
ls -la .git/hooks/pre-commit

# Should show:
# -rwxr-xr-x ... .git/hooks/pre-commit

# Test hook
.git/hooks/pre-commit
```

## Using the Hook

### Normal Operation

The hook runs **automatically** on every commit:

```bash
# Stage changes
git add file.ts

# Commit (hook runs automatically)
git commit -m "feat: add new feature"

# Hook validates and either:
# ✅ Allows commit if validation passes
# ❌ Blocks commit if validation fails
```

### Hook Output

**Success:**
```
=====================================================================
AI Agent Enforcement - Pre-Commit Validation
=====================================================================

[1/6] Checking .ai-agents system...
✓ .ai-agents system verified
[2/6] Checking OpenMemory connection...
✓ OpenMemory is accessible
[3/6] Analyzing staged changes...
✓ 3 file(s) staged for commit
[4/6] Checking for recent AI agent activity...
✓ Recent AI agent activity found in OpenMemory
[5/6] Checking for state file updates...
✓ State files are being updated
[6/6] Validating autonomous mode compliance...
✓ No autonomous mode violations detected

=====================================================================
✅ PRE-COMMIT VALIDATION PASSED
=====================================================================
Commit is allowed to proceed.
```

**Failure:**
```
=====================================================================
AI Agent Enforcement - Pre-Commit Validation
=====================================================================

[1/6] Checking .ai-agents system...
✓ .ai-agents system verified
[2/6] Checking OpenMemory connection...
❌ OpenMemory is not accessible at http://localhost:8080 and fallback is disabled.

❌ COMMIT BLOCKED - ENFORCEMENT VIOLATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OpenMemory is not accessible at http://localhost:8080 and fallback is disabled.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

AI agents must:
  1. Record all actions in OpenMemory
  2. Update project state regularly
  3. Follow autonomous mode requirements

See: .ai-agents/enforcement/README.md

To bypass in emergencies (NOT RECOMMENDED):
  AI_AGENT_HOOK_BYPASS=true git commit -m "message"
Bypasses are logged and monitored.
```

## Emergency Bypass

**⚠️ Use only in true emergencies**

```bash
# Bypass hook for one commit
AI_AGENT_HOOK_BYPASS=true git commit -m "emergency: critical fix"
```

**What happens when you bypass:**
- ✅ Commit proceeds without validation
- ⚠️ Bypass is logged to `hook-executions.log`
- ⚠️ Watchdog will detect and report bypass
- ⚠️ Enforcement status will show violation

**Bypasses are monitored** - they should be rare and justified.

## Configuration

The hook reads configuration from `.ai-agents/config.json`:

```json
{
  "openmemory": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "fallback_to_local": true,
    "user_id": "ai-agent-system"
  },
  "enforcement": {
    "git_hooks_enabled": true,
    "strict_mode": false
  }
}
```

### Key Settings

| Setting | Effect | Default |
|---------|--------|---------|
| `openmemory.enabled` | Whether to use OpenMemory | `true` |
| `openmemory.fallback_to_local` | Allow fallback if OpenMemory unavailable | `true` |
| `enforcement.git_hooks_enabled` | Enable git hook enforcement | `true` |
| `enforcement.strict_mode` | Convert warnings to blocks | `false` |

## Environment Variables

```bash
# OpenMemory URL (overrides config)
export OPENMEMORY_URL=http://localhost:8080

# Emergency bypass (logs bypass)
export AI_AGENT_HOOK_BYPASS=true  # Not recommended
```

## Troubleshooting

### Hook Not Running

**Problem**: Git commits succeed without any validation output

**Solution**:
```bash
# Check if hook exists
ls -la .git/hooks/pre-commit

# If missing, reinstall
./.ai-agents/enforcement/git-hooks/install-hooks.sh

# Check if executable
chmod +x .git/hooks/pre-commit
```

### Hook Blocks Valid Commits

**Problem**: Hook blocks commits that should be allowed

**Solutions**:

1. **OpenMemory not running**
   ```bash
   # Option 1: Start OpenMemory
   cd backend && npm run dev

   # Option 2: Enable fallback
   # Edit .ai-agents/config.json:
   "openmemory": {
     "fallback_to_local": true
   }
   ```

2. **Config file missing**
   ```bash
   # Reinstall hooks (creates config)
   ./.ai-agents/enforcement/git-hooks/install-hooks.sh
   ```

3. **Temporary bypass** (emergency only)
   ```bash
   AI_AGENT_HOOK_BYPASS=true git commit -m "message"
   ```

### Slow Hook Execution

**Problem**: Hook takes too long to run

**Causes**:
- OpenMemory server not responding (5 second timeout)
- Network issues
- Comprehensive validation taking too long

**Solutions**:
```bash
# Reduce timeout by editing hook
# Or disable optional validation
# Or use fallback mode
```

## Logs and Monitoring

### Hook Execution Log

**Location**: `.ai-agents/enforcement/git-hooks/hook-executions.log`

**Format**:
```
2025-11-05T10:30:00Z - START - Project: OpenMemory
2025-11-05T10:30:02Z - PASSED - Project: OpenMemory, Files: 5
2025-11-05T10:30:05Z - BLOCKED - OpenMemory not accessible
2025-11-05T10:30:10Z - BYPASS - User: dev@example.com
2025-11-05T10:35:00Z - WARNING - No state file updates with code changes
```

**View recent logs**:
```bash
tail -20 .ai-agents/enforcement/git-hooks/hook-executions.log
```

### Integration with Watchdog

The watchdog service monitors hook activity:
- Detects bypasses
- Tracks block frequency
- Reports violations
- Correlates with OpenMemory records

## For Claude Code Users

The git hook **solves the enforcement gap** for Claude Code:

### Before Git Hooks:
❌ Claude Code could edit files directly
❌ No validation of changes
❌ Could commit without recording actions
❌ Could bypass all enforcement

### With Git Hooks:
✅ All commits must pass validation
✅ Cannot commit without proper state updates
✅ Autonomous mode violations detected
✅ Activity must be present in OpenMemory
✅ **True enforcement that cannot be bypassed** (without logging)

### Workflow for Claude Code:
1. Claude Code makes changes using file tools
2. Claude Code stages changes: `git add ...`
3. Claude Code attempts commit: `git commit -m "..."`
4. **Hook runs automatically** and validates
5. If validation passes → Commit succeeds
6. If validation fails → Commit blocked, Claude Code sees error

This creates **mandatory compliance** for Claude Code.

## Testing

### Test the Hook

```bash
# Test 1: Run hook directly (no commit)
.git/hooks/pre-commit

# Test 2: Make trivial commit
echo "test" > test.txt
git add test.txt
git commit -m "test: verify hook"

# Should see validation output

# Test 3: Test blocking
# Stop OpenMemory, disable fallback
# Try to commit - should block
```

### Expected Behavior

- ✅ Hook runs on every commit
- ✅ Takes 1-3 seconds
- ✅ Shows validation steps
- ✅ Blocks invalid commits
- ✅ Logs all executions
- ✅ Integrates with OpenMemory (if available)

## Advanced Usage

### Custom Validation

You can add custom checks to the hook:

```bash
# Edit .git/hooks/pre-commit
# Add custom validation before the success message

# Example: Check for TODO comments in staged code
if git diff --cached | grep -i "TODO"; then
    echo "⚠ TODO comments found in staged changes"
fi
```

### Per-Project Configuration

Different projects can have different enforcement levels:

```json
// Strict project
{
  "enforcement": {
    "strict_mode": true,
    "block_on_no_activity": true
  }
}

// Relaxed project
{
  "enforcement": {
    "strict_mode": false,
    "block_on_no_activity": false
  }
}
```

### Multi-Project Setup

For organizations with many projects:

1. Create enforcement template repository
2. Add as git submodule or copy files
3. Run installation in each project
4. Customize config per project

## Integration with CI/CD

The hook can also run in CI/CD:

```yaml
# .github/workflows/validate.yml
name: AI Agent Validation

on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Run enforcement hook
        run: .git/hooks/pre-commit
        env:
          OPENMEMORY_URL: ${{ secrets.OPENMEMORY_URL }}
```

## Summary

The git pre-commit hook provides:

✅ **True enforcement** for AI agents with file access (Claude Code)
✅ **Automatic validation** on every commit
✅ **Cannot be bypassed** without logging
✅ **Integrates** with existing enforcement systems
✅ **Works for any project** (not just OpenMemory)
✅ **Comprehensive validation** in 1-3 seconds
✅ **Detailed logging** for auditing
✅ **Emergency bypass** available (but monitored)

This solves the critical gap where API-level enforcement couldn't prevent direct file system changes.

**AI agents can no longer commit without validation!**
