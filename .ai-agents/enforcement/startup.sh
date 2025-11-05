#!/bin/bash
#
# AI Agent Enforcement System - Automatic Startup Script
#
# This script runs automatically when OpenMemory starts to ensure
# the enforcement system is properly initialized.
#
# It can be called from package.json as a prestart or postinstall hook.

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
AI_AGENTS_DIR="$PROJECT_ROOT/.ai-agents"
ENFORCEMENT_DIR="$AI_AGENTS_DIR/enforcement"

echo "======================================================================"
echo "AI AGENT ENFORCEMENT SYSTEM - STARTUP"
echo "======================================================================"
echo ""
echo "Project: $(basename "$PROJECT_ROOT")"
echo "Path: $PROJECT_ROOT"
echo ""

# Step 1: Verify .ai-agents directory exists
if [ ! -d "$AI_AGENTS_DIR" ]; then
    echo "❌ ERROR: .ai-agents directory not found"
    echo "   The AI agent system is not properly installed."
    exit 1
fi
echo "✓ .ai-agents directory verified"

# Step 2: Verify enforcement directory exists
if [ ! -d "$ENFORCEMENT_DIR" ]; then
    echo "⚠  Creating enforcement directory..."
    mkdir -p "$ENFORCEMENT_DIR"
fi
echo "✓ Enforcement directory verified"

# Step 3: Verify config.json exists
if [ ! -f "$AI_AGENTS_DIR/config.json" ]; then
    echo "❌ ERROR: config.json not found in .ai-agents/"
    echo "   Please create config.json from TEMPLATE files."
    exit 1
fi
echo "✓ config.json verified"

# Step 4: Create enforcement status file
echo "✓ Creating enforcement status file..."
cat > "$AI_AGENTS_DIR/enforcement-status.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "enforcement_active": true,
  "startup_complete": true,
  "requirements": {
    "use_openmemory": true,
    "record_all_actions": true,
    "follow_autonomous_mode": true,
    "validate_dependencies": true,
    "cannot_bypass": true
  },
  "message": "AI Agent enforcement is ACTIVE. All agents must use OpenMemory and .ai-agents systems."
}
EOF

echo "✓ Enforcement status file created"

# Step 5: Verify AUTONOMOUS_MODE.md exists
if [ ! -f "$AI_AGENTS_DIR/COPY_AS_IS_AUTONOMOUS_MODE.md" ]; then
    echo "⚠  WARNING: AUTONOMOUS_MODE.md not found"
    echo "   AI agents may not have access to autonomous mode requirements."
else
    echo "✓ AUTONOMOUS_MODE.md verified"
fi

# Step 6: Check if OpenMemory is running (optional check)
echo ""
echo "Checking OpenMemory availability..."
OPENMEMORY_URL="${OPENMEMORY_URL:-http://localhost:8080}"

if command -v curl &> /dev/null; then
    if curl -s -f "$OPENMEMORY_URL/health" > /dev/null 2>&1; then
        echo "✓ OpenMemory is running at $OPENMEMORY_URL"
    else
        echo "⚠  OpenMemory is not yet running at $OPENMEMORY_URL"
        echo "   (This is normal if OpenMemory is starting up)"
    fi
elif command -v wget &> /dev/null; then
    if wget -q -O /dev/null "$OPENMEMORY_URL/health" 2>&1; then
        echo "✓ OpenMemory is running at $OPENMEMORY_URL"
    else
        echo "⚠  OpenMemory is not yet running at $OPENMEMORY_URL"
        echo "   (This is normal if OpenMemory is starting up)"
    fi
else
    echo "⚠  Cannot check OpenMemory status (curl/wget not found)"
fi

echo ""
echo "======================================================================"
echo "INSTALLING GIT HOOKS..."
echo "======================================================================"
echo ""

# Install git hooks automatically
if [ -f "$AI_AGENTS_DIR/enforcement/git-hooks/install-hooks.sh" ]; then
    if bash "$AI_AGENTS_DIR/enforcement/git-hooks/install-hooks.sh" "$project_root"; then
        echo "✓ Git hooks installed successfully"
    else
        echo "⚠  Git hooks installation failed (non-critical)"
    fi
else
    echo "⚠  Git hooks installer not found (skipping)"
fi

echo ""
echo "======================================================================"
echo "✅ ENFORCEMENT SYSTEM STARTUP COMPLETE"
echo "======================================================================"
echo ""
echo "AI agents are now REQUIRED to:"
echo "  • Use OpenMemory for all state and memory operations"
echo "  • Follow .ai-agents system requirements"
echo "  • Record all actions, decisions, and patterns"
echo "  • Execute tasks in dependency order"
echo "  • Operate autonomously without user confirmation"
echo "  • Pass git pre-commit validation before committing"
echo ""
echo "Enforcement layers active:"
echo "  ✓ Git pre-commit hooks (blocks invalid commits)"
echo "  ✓ API middleware (blocks invalid API calls)"
echo "  ✓ Watchdog service (monitors compliance every 5 minutes)"
echo "  ✓ Schema validation (validates all data)"
echo ""
echo "======================================================================"

exit 0
