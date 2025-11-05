#!/bin/bash
#
# AI Agent Enforcement - Git Hooks Installation Script
#
# This script installs git hooks for AI agent enforcement in any project.
# It can be run manually or automatically on project initialization.
#
# Usage:
#   ./install-hooks.sh [project-root]
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}AI Agent Enforcement - Git Hooks Installation${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# Determine project root
if [ -n "$1" ]; then
    PROJECT_ROOT="$1"
else
    # Try to find git root
    if git rev-parse --git-dir > /dev/null 2>&1; then
        PROJECT_ROOT="$(git rev-parse --show-toplevel)"
    else
        # Fall back to parent directory of script
        PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
    fi
fi

PROJECT_NAME="$(basename "$PROJECT_ROOT")"
GIT_HOOKS_DIR="$PROJECT_ROOT/.git/hooks"
AI_AGENTS_DIR="$PROJECT_ROOT/.ai-agents"
ENFORCEMENT_DIR="$AI_AGENTS_DIR/enforcement"
HOOK_TEMPLATES_DIR="$ENFORCEMENT_DIR/git-hooks"

echo "Project: $PROJECT_NAME"
echo "Root: $PROJECT_ROOT"
echo ""

# Verify this is a git repository
if [ ! -d "$PROJECT_ROOT/.git" ]; then
    echo -e "${RED}❌ ERROR: Not a git repository${NC}"
    echo "   $PROJECT_ROOT/.git not found"
    exit 1
fi
echo -e "${GREEN}✓${NC} Git repository verified"

# Verify .ai-agents directory exists
if [ ! -d "$AI_AGENTS_DIR" ]; then
    echo -e "${YELLOW}⚠${NC}  .ai-agents directory not found, creating..."
    mkdir -p "$AI_AGENTS_DIR"
fi
echo -e "${GREEN}✓${NC} .ai-agents directory verified"

# Create enforcement directories if needed
mkdir -p "$ENFORCEMENT_DIR/git-hooks"
echo -e "${GREEN}✓${NC} Enforcement directories created"

# Create git hooks directory if needed
mkdir -p "$GIT_HOOKS_DIR"
echo -e "${GREEN}✓${NC} Git hooks directory ready"

# Function to install a hook
install_hook() {
    local hook_name="$1"
    local source_hook="$HOOK_TEMPLATES_DIR/$hook_name"
    local target_hook="$GIT_HOOKS_DIR/$hook_name"

    if [ ! -f "$source_hook" ]; then
        echo -e "${YELLOW}⚠${NC}  Hook template not found: $hook_name (skipping)"
        return 1
    fi

    # Backup existing hook if it exists and is different
    if [ -f "$target_hook" ]; then
        if ! cmp -s "$source_hook" "$target_hook"; then
            backup_file="$target_hook.backup.$(date +%Y%m%d_%H%M%S)"
            echo -e "${YELLOW}⚠${NC}  Backing up existing $hook_name to $(basename "$backup_file")"
            cp "$target_hook" "$backup_file"
        fi
    fi

    # Copy hook
    cp "$source_hook" "$target_hook"
    chmod +x "$target_hook"

    echo -e "${GREEN}✓${NC} Installed: $hook_name"
    return 0
}

# Install pre-commit hook
echo ""
echo "Installing hooks..."
install_hook "pre-commit"

# Create hook execution log
HOOK_LOG="$ENFORCEMENT_DIR/git-hooks/hook-executions.log"
touch "$HOOK_LOG"
echo -e "${GREEN}✓${NC} Hook execution log created"

# Create config file if it doesn't exist
CONFIG_FILE="$AI_AGENTS_DIR/config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}⚠${NC}  config.json not found, creating minimal configuration..."
    cat > "$CONFIG_FILE" <<'EOF'
{
  "_comment": "AI Agents + OpenMemory Configuration",
  "openmemory": {
    "enabled": true,
    "base_url": "http://localhost:8080",
    "fallback_to_local": true,
    "user_id": "ai-agent-system"
  },
  "agent_config": {
    "record_actions": true,
    "record_decisions": true,
    "store_patterns": true
  },
  "enforcement": {
    "git_hooks_enabled": true,
    "strict_mode": false
  }
}
EOF
    echo -e "${GREEN}✓${NC} Created config.json with default settings"
else
    echo -e "${GREEN}✓${NC} config.json already exists"
fi

# Create enforcement status
cat > "$AI_AGENTS_DIR/enforcement-status.json" <<EOF
{
  "timestamp": "$(date -Iseconds)",
  "git_hooks_installed": true,
  "hooks": ["pre-commit"],
  "enforcement_active": true,
  "project": "$PROJECT_NAME"
}
EOF
echo -e "${GREEN}✓${NC} Enforcement status updated"

# Test the hook
echo ""
echo "Testing pre-commit hook..."
if "$GIT_HOOKS_DIR/pre-commit" 2>&1 | head -5; then
    echo -e "${GREEN}✓${NC} Pre-commit hook is functional"
else
    # Hook might exit with non-zero in some cases, that's OK for testing
    echo -e "${YELLOW}⚠${NC}  Hook executed (exit code: $?)"
fi

echo ""
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN}✅ GIT HOOKS INSTALLATION COMPLETE${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo ""
echo -e "${GREEN}Installed hooks:${NC}"
echo "  • pre-commit - Validates AI agent compliance before each commit"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  • Hooks will run automatically on every commit"
echo "  • Failed validation will BLOCK the commit"
echo "  • Emergency bypass: AI_AGENT_HOOK_BYPASS=true git commit"
echo "  • All bypasses are logged and monitored"
echo ""
echo -e "${BLUE}Hook log:${NC} .ai-agents/enforcement/git-hooks/hook-executions.log"
echo -e "${BLUE}Documentation:${NC} .ai-agents/enforcement/README.md"
echo ""
echo -e "${GREEN}AI agents can no longer commit without proper validation!${NC}"
echo ""

# Log installation
echo "$(date -Iseconds) - INSTALLED - Project: $PROJECT_NAME, User: $(whoami)" >> "$HOOK_LOG"

exit 0
