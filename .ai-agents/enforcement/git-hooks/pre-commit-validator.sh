#!/bin/bash
#
# OpenMemory + AI Agents - Global Pre-Commit Validator
#
# This script is called by project-specific git hooks and performs
# validation using the centralized global system.
#
# Args:
#   $1 - Project name
#   $2 - Global directory path
#

set -e

PROJECT_NAME="$1"
GLOBAL_DIR="$2"
OPENMEMORY_URL="${OPENMEMORY_URL:-http://localhost:8080}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Bypass mechanism
if [ "${AI_AGENT_HOOK_BYPASS:-false}" = "true" ]; then
    echo -e "${YELLOW}⚠️  WARNING: AI Agent Enforcement Hook BYPASSED${NC}"
    echo "$(date -Iseconds) - BYPASS - Project: ${PROJECT_NAME}, User: $(git config user.email 2>/dev/null || echo 'unknown')" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"
    echo -e "${YELLOW}This bypass has been logged and will be reviewed by the watchdog.${NC}"
    exit 0
fi

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}AI Agent Enforcement - Pre-Commit Validation (Global System)${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""
echo "Project: ${PROJECT_NAME}"
echo "Global System: ${GLOBAL_DIR}"
echo ""

# Function to fail the commit
fail_commit() {
    local message="$1"
    echo ""
    echo -e "${RED}❌ COMMIT BLOCKED - ENFORCEMENT VIOLATION${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}$message${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}AI agents must:${NC}"
    echo -e "  1. Record all actions in OpenMemory"
    echo -e "  2. Update project state regularly"
    echo -e "  3. Follow autonomous mode requirements"
    echo ""
    echo -e "${YELLOW}To bypass in emergencies (NOT RECOMMENDED):${NC}"
    echo -e "  AI_AGENT_HOOK_BYPASS=true git commit -m \"message\""
    echo -e "${YELLOW}Bypasses are logged and monitored.${NC}"
    echo ""
    echo "$(date -Iseconds) - BLOCKED - Project: ${PROJECT_NAME}, Reason: $message" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"
    exit 1
}

# Function to call OpenMemory API
call_openmemory() {
    local endpoint="$1"
    local method="${2:-GET}"

    if command -v curl &> /dev/null; then
        curl -s -X "$method" \
             -H "Content-Type: application/json" \
             --max-time 5 \
             "$OPENMEMORY_URL$endpoint" 2>/dev/null || echo "{}"
    elif command -v wget &> /dev/null; then
        wget -q -O - \
             --method="$method" \
             --header="Content-Type: application/json" \
             --timeout=5 \
             "$OPENMEMORY_URL$endpoint" 2>/dev/null || echo "{}"
    else
        echo "{}"
    fi
}

# Create project log directory
mkdir -p "${GLOBAL_DIR}/projects/${PROJECT_NAME}"

echo "$(date -Iseconds) - START - Project: ${PROJECT_NAME}" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"

# [1/6] Check global system
echo -e "${BLUE}[1/6]${NC} Checking global system..."
if [ ! -d "${GLOBAL_DIR}/ai-agents-template" ]; then
    fail_commit "Global AI agents template not found at ${GLOBAL_DIR}"
fi
if [ ! -f "${GLOBAL_DIR}/projects/registry.json" ]; then
    fail_commit "Global project registry not found"
fi
echo -e "${GREEN}✓${NC} Global system verified"

# [2/6] Check OpenMemory connection
echo -e "${BLUE}[2/6]${NC} Checking OpenMemory connection..."
health_response=$(call_openmemory "/health")
if echo "$health_response" | grep -q '"ok":true' || echo "$health_response" | grep -q '"status":"ok"'; then
    echo -e "${GREEN}✓${NC} OpenMemory is accessible at ${OPENMEMORY_URL}"
else
    echo -e "${YELLOW}⚠${NC}  OpenMemory not accessible - commits allowed but actions not tracked"
    echo "$(date -Iseconds) - WARNING - OpenMemory not accessible" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"
fi

# [3/6] Analyze staged changes
echo -e "${BLUE}[3/6]${NC} Analyzing staged changes..."
staged_files=$(git diff --cached --name-only)
if [ -z "$staged_files" ]; then
    echo -e "${YELLOW}⚠${NC}  No staged files found"
else
    file_count=$(echo "$staged_files" | wc -l)
    echo -e "${GREEN}✓${NC} $file_count file(s) staged for commit"

    # Check for significant code changes
    significant_changes=false
    while IFS= read -r file; do
        if [[ "$file" =~ \.(ts|js|py|go|java|rs|cpp|c|h|jsx|tsx)$ ]]; then
            significant_changes=true
            break
        fi
    done <<< "$staged_files"

    if [ "$significant_changes" = true ]; then
        echo -e "${BLUE}  → Significant code changes detected${NC}"
    fi
fi

# [4/6] Check for recent AI agent activity
echo -e "${BLUE}[4/6]${NC} Checking for recent AI agent activity..."
if echo "$health_response" | grep -q '"ok":true' || echo "$health_response" | grep -q '"status":"ok"'; then
    history_response=$(call_openmemory "/ai-agents/history/${PROJECT_NAME}?limit=5&user_id=project-${PROJECT_NAME}")

    if echo "$history_response" | grep -q '"success":true'; then
        if echo "$history_response" | grep -q '"count":[1-9]'; then
            echo -e "${GREEN}✓${NC} Recent AI agent activity found in OpenMemory"
        else
            echo -e "${YELLOW}⚠${NC}  No recent AI agent activity found"
            echo -e "${YELLOW}  This may indicate actions were not recorded.${NC}"
            echo "$(date -Iseconds) - WARNING - No recent activity" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Could not verify activity (OpenMemory query failed)"
    fi
else
    echo -e "${YELLOW}⚠${NC}  Skipping activity check (OpenMemory not accessible)"
fi

# [5/6] Check for state file updates (in global system)
echo -e "${BLUE}[5/6]${NC} Checking for state tracking..."
state_file="${GLOBAL_DIR}/projects/${PROJECT_NAME}/state.json"
if [ -f "$state_file" ]; then
    echo -e "${GREEN}✓${NC} Project state is being tracked globally"
elif [ "$significant_changes" = true ]; then
    echo -e "${YELLOW}⚠${NC}  Significant changes but no state tracking"
    echo -e "${YELLOW}  Consider updating project state in OpenMemory${NC}"
else
    echo -e "${GREEN}✓${NC} No state update required"
fi

# [6/6] Validate autonomous mode compliance
echo -e "${BLUE}[6/6]${NC} Validating autonomous mode compliance..."
commit_msg=""
if [ -f ".git/COMMIT_EDITMSG" ]; then
    commit_msg=$(cat .git/COMMIT_EDITMSG)
fi

violations=()
if [ -n "$commit_msg" ]; then
    if echo "$commit_msg" | grep -qiE "(should i|would you like|do you want|shall i|can i\?)"; then
        violations+=("Commit message contains questions (autonomous mode violation)")
    fi

    if echo "$commit_msg" | grep -qiE "(please confirm|need approval|waiting for|ask user)"; then
        violations+=("Commit message suggests waiting for confirmation")
    fi

    if [ ${#violations[@]} -gt 0 ]; then
        echo -e "${YELLOW}⚠${NC}  Potential autonomous mode violations detected:"
        for violation in "${violations[@]}"; do
            echo -e "${YELLOW}    - $violation${NC}"
        done
        echo "$(date -Iseconds) - WARNING - Autonomous violations: ${violations[*]}" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"
    else
        echo -e "${GREEN}✓${NC} No autonomous mode violations detected"
    fi
else
    echo -e "${GREEN}✓${NC} Commit message not yet available"
fi

# Optional: Run comprehensive validation if OpenMemory is accessible
if echo "$health_response" | grep -q '"ok":true'; then
    echo ""
    echo -e "${BLUE}[OPTIONAL]${NC} Running comprehensive validation..."
    validation_response=$(call_openmemory "/ai-agents/validate/consistency/${PROJECT_NAME}?user_id=project-${PROJECT_NAME}" "GET" 2>/dev/null || echo "{}")

    if echo "$validation_response" | grep -q '"success":true'; then
        issues=$(echo "$validation_response" | grep -oP '"issues_found":\s*\K[0-9]+' || echo "0")
        if [ "$issues" = "0" ]; then
            echo -e "${GREEN}✓${NC} Comprehensive validation passed (0 issues)"
        else
            echo -e "${YELLOW}⚠${NC}  Comprehensive validation found $issues issue(s)"
            echo -e "${YELLOW}  These issues will be tracked by the watchdog${NC}"
        fi
    else
        echo -e "${YELLOW}⚠${NC}  Comprehensive validation skipped (service not available)"
    fi
fi

# Success!
echo ""
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN}✅ PRE-COMMIT VALIDATION PASSED (Global System)${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN}Commit is allowed to proceed.${NC}"
echo ""
echo "$(date -Iseconds) - PASSED - Project: ${PROJECT_NAME}, Files: $(echo "$staged_files" | wc -l)" >> "${GLOBAL_DIR}/projects/${PROJECT_NAME}/hook-executions.log"

exit 0
