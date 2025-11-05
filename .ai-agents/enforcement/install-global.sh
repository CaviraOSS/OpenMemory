#!/bin/bash
#
# OpenMemory + AI Agents - Global Installation Script
#
# This script installs the OpenMemory + AI Agents system globally,
# allowing it to manage multiple projects from a centralized location.
#
# Usage: curl -sSL https://raw.githubusercontent.com/.../install-global.sh | bash
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}OpenMemory + AI Agents - Global Installation${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# Configuration
GLOBAL_DIR="${HOME}/.openmemory-global"
BACKEND_DIR="${GLOBAL_DIR}/backend"
TEMPLATE_DIR="${GLOBAL_DIR}/ai-agents-template"
PROJECTS_DIR="${GLOBAL_DIR}/projects"
WATCHER_DIR="${GLOBAL_DIR}/watcher"
BIN_DIR="${GLOBAL_DIR}/bin"

# Detect OS
OS="$(uname -s)"
case "${OS}" in
    Linux*)     OS_TYPE=Linux;;
    Darwin*)    OS_TYPE=Mac;;
    CYGWIN*)    OS_TYPE=Cygwin;;
    MINGW*)     OS_TYPE=MinGw;;
    *)          OS_TYPE="UNKNOWN:${OS}"
esac

echo -e "${GREEN}Detected OS: ${OS_TYPE}${NC}"
echo ""

# Check requirements
echo "Checking requirements..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 20+ first.${NC}"
    echo "   Visit: https://nodejs.org/"
    exit 1
fi
NODE_VERSION=$(node --version)
echo -e "${GREEN}✓ Node.js ${NODE_VERSION}${NC}"

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm not found. Please install npm.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm --version)${NC}"

# Check git
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git not found. Please install git.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ git $(git --version | head -1)${NC}"

# Check Python (optional but recommended)
if command -v python3 &> /dev/null; then
    echo -e "${GREEN}✓ Python $(python3 --version | awk '{print $2}')${NC}"
else
    echo -e "${YELLOW}⚠ Python not found (optional, but recommended for full features)${NC}"
fi

echo ""

# Create global directory structure
echo "Creating global directory structure..."
mkdir -p "${GLOBAL_DIR}"
mkdir -p "${BACKEND_DIR}"
mkdir -p "${TEMPLATE_DIR}"
mkdir -p "${PROJECTS_DIR}"
mkdir -p "${WATCHER_DIR}"
mkdir -p "${BIN_DIR}"
echo -e "${GREEN}✓ Directories created${NC}"

# Check if already installed
if [ -f "${GLOBAL_DIR}/.installed" ]; then
    echo ""
    echo -e "${YELLOW}⚠ OpenMemory global system is already installed.${NC}"
    read -p "Reinstall? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi
    echo "Reinstalling..."
fi

# Clone or update OpenMemory repository
echo ""
echo "Installing OpenMemory backend..."
if [ -d "${BACKEND_DIR}/.git" ]; then
    echo "Updating existing installation..."
    cd "${BACKEND_DIR}"
    git pull origin main
else
    echo "Cloning OpenMemory repository..."
    git clone https://github.com/caviraoss/openmemory.git "${BACKEND_DIR}"
fi

# Install backend dependencies
cd "${BACKEND_DIR}/backend"
echo "Installing backend dependencies..."
npm install --silent
echo -e "${GREEN}✓ Backend installed${NC}"

# Create .env file if it doesn't exist
if [ ! -f "${BACKEND_DIR}/backend/.env" ]; then
    echo "Creating .env configuration..."
    cp "${BACKEND_DIR}/backend/.env.example" "${BACKEND_DIR}/backend/.env"
    echo -e "${GREEN}✓ Configuration created${NC}"
fi

# Copy AI agents template
echo ""
echo "Installing AI agents template..."
if [ -d "${BACKEND_DIR}/.ai-agents" ]; then
    cp -r "${BACKEND_DIR}/.ai-agents/"* "${TEMPLATE_DIR}/"
    echo -e "${GREEN}✓ Template installed${NC}"
else
    echo -e "${YELLOW}⚠ .ai-agents directory not found in repository${NC}"
fi

# Create project registry
echo ""
echo "Creating project registry..."
cat > "${PROJECTS_DIR}/registry.json" <<'EOF'
{
  "version": "1.0",
  "projects": {},
  "created": "",
  "updated": ""
}
EOF
TIMESTAMP=$(date -Iseconds)
sed -i.bak "s/\"created\": \"\"/\"created\": \"${TIMESTAMP}\"/" "${PROJECTS_DIR}/registry.json"
sed -i.bak "s/\"updated\": \"\"/\"updated\": \"${TIMESTAMP}\"/" "${PROJECTS_DIR}/registry.json"
rm "${PROJECTS_DIR}/registry.json.bak" 2>/dev/null || true
echo -e "${GREEN}✓ Registry created${NC}"

# Create project initializer script
echo ""
echo "Creating project management scripts..."

# openmemory-init
cat > "${BIN_DIR}/openmemory-init" <<'SCRIPT'
#!/bin/bash
#
# Initialize OpenMemory + AI Agents for a project
#
# Usage: openmemory-init [project-directory]
#

set -e

GLOBAL_DIR="${HOME}/.openmemory-global"
PROJECT_DIR="${1:-.}"
PROJECT_DIR="$(cd "${PROJECT_DIR}" && pwd)"
PROJECT_NAME="$(basename "${PROJECT_DIR}")"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}Initializing OpenMemory + AI Agents for: ${PROJECT_NAME}${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo ""

# Check if git repository
if [ ! -d "${PROJECT_DIR}/.git" ]; then
    echo -e "${YELLOW}⚠ Not a git repository. Initializing...${NC}"
    cd "${PROJECT_DIR}"
    git init
    echo -e "${GREEN}✓ Git repository initialized${NC}"
fi

# Create .openmemory link file
cat > "${PROJECT_DIR}/.openmemory" <<EOF
# OpenMemory Global System Link
# This project uses the centralized OpenMemory + AI Agents system
# Global directory: ${GLOBAL_DIR}
# Project name: ${PROJECT_NAME}
# Initialized: $(date -Iseconds)

GLOBAL_DIR=${GLOBAL_DIR}
PROJECT_NAME=${PROJECT_NAME}
OPENMEMORY_URL=http://localhost:8080
EOF

echo -e "${GREEN}✓ Created .openmemory link file${NC}"

# Install git hooks
echo "Installing git hooks..."
mkdir -p "${PROJECT_DIR}/.git/hooks"

# Copy pre-commit hook with global system awareness
cat > "${PROJECT_DIR}/.git/hooks/pre-commit" <<'HOOK'
#!/bin/bash
# OpenMemory + AI Agents - Pre-Commit Hook (Global System)
# This hook connects to the global OpenMemory system

set -e

# Load global configuration
if [ -f ".openmemory" ]; then
    source .openmemory
else
    echo "❌ ERROR: .openmemory file not found"
    echo "   Run: openmemory-init"
    exit 1
fi

# Execute global pre-commit validation
if [ -f "${GLOBAL_DIR}/ai-agents-template/enforcement/git-hooks/pre-commit-validator.sh" ]; then
    exec "${GLOBAL_DIR}/ai-agents-template/enforcement/git-hooks/pre-commit-validator.sh" "${PROJECT_NAME}" "${GLOBAL_DIR}"
else
    echo "⚠ WARNING: Global validator not found, skipping validation"
    exit 0
fi
HOOK

chmod +x "${PROJECT_DIR}/.git/hooks/pre-commit"
echo -e "${GREEN}✓ Git hooks installed${NC}"

# Register project with global system
echo "Registering project..."
REGISTRY="${GLOBAL_DIR}/projects/registry.json"
TIMESTAMP=$(date -Iseconds)

# Create project entry in registry (using Python for JSON manipulation)
python3 <<PYTHON
import json
import sys
from pathlib import Path

registry_file = Path("${REGISTRY}")
registry = json.loads(registry_file.read_text())

registry["projects"]["${PROJECT_NAME}"] = {
    "path": "${PROJECT_DIR}",
    "initialized": "${TIMESTAMP}",
    "last_active": "${TIMESTAMP}",
    "openmemory_user_id": "project-${PROJECT_NAME}",
    "status": "active"
}
registry["updated"] = "${TIMESTAMP}"

registry_file.write_text(json.dumps(registry, indent=2))
print("✓ Project registered")
PYTHON

# Create project directory in global projects folder
mkdir -p "${GLOBAL_DIR}/projects/${PROJECT_NAME}"

echo ""
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN}✅ Project initialized successfully!${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo ""
echo "Project: ${PROJECT_NAME}"
echo "Location: ${PROJECT_DIR}"
echo "Global system: ${GLOBAL_DIR}"
echo ""
echo "Next steps:"
echo "  1. Start OpenMemory backend: openmemory-start"
echo "  2. Begin coding - the system is active!"
echo "  3. All actions will be tracked automatically"
echo ""
SCRIPT

chmod +x "${BIN_DIR}/openmemory-init"
echo -e "${GREEN}✓ openmemory-init created${NC}"

# openmemory-start
cat > "${BIN_DIR}/openmemory-start" <<'SCRIPT'
#!/bin/bash
# Start OpenMemory backend server

GLOBAL_DIR="${HOME}/.openmemory-global"
cd "${GLOBAL_DIR}/backend/backend"

echo "Starting OpenMemory backend..."
echo "Access at: http://localhost:8080"
echo "Press Ctrl+C to stop"
echo ""

npm run dev
SCRIPT

chmod +x "${BIN_DIR}/openmemory-start"
echo -e "${GREEN}✓ openmemory-start created${NC}"

# openmemory-status
cat > "${BIN_DIR}/openmemory-status" <<'SCRIPT'
#!/bin/bash
# Show status of OpenMemory global system

GLOBAL_DIR="${HOME}/.openmemory-global"
REGISTRY="${GLOBAL_DIR}/projects/registry.json"

echo "======================================================================"
echo "OpenMemory + AI Agents - Global System Status"
echo "======================================================================"
echo ""
echo "Installation: ${GLOBAL_DIR}"
echo ""

# Check if backend is running
if curl -s http://localhost:8080/health > /dev/null 2>&1; then
    echo "✓ Backend: Running (http://localhost:8080)"
else
    echo "✗ Backend: Not running (start with: openmemory-start)"
fi

echo ""
echo "Registered projects:"
echo "----------------------------------------------------------------------"

if [ -f "${REGISTRY}" ]; then
    python3 <<PYTHON
import json
from pathlib import Path

registry = json.loads(Path("${REGISTRY}").read_text())
projects = registry.get("projects", {})

if not projects:
    print("  No projects registered yet.")
else:
    for name, info in projects.items():
        status = info.get("status", "unknown")
        path = info.get("path", "")
        print(f"  • {name} ({status})")
        print(f"    {path}")
PYTHON
else
    echo "  Registry not found."
fi

echo ""
SCRIPT

chmod +x "${BIN_DIR}/openmemory-status"
echo -e "${GREEN}✓ openmemory-status created${NC}"

# openmemory-list
cat > "${BIN_DIR}/openmemory-list" <<'SCRIPT'
#!/bin/bash
# List all registered projects

GLOBAL_DIR="${HOME}/.openmemory-global"
REGISTRY="${GLOBAL_DIR}/projects/registry.json"

python3 <<PYTHON
import json
from pathlib import Path

registry = json.loads(Path("${REGISTRY}").read_text())
projects = registry.get("projects", {})

if not projects:
    print("No projects registered.")
else:
    print(f"Registered projects: {len(projects)}")
    print("")
    for name, info in projects.items():
        status = info.get("status", "unknown")
        path = info.get("path", "")
        initialized = info.get("initialized", "")
        print(f"{name}")
        print(f"  Status: {status}")
        print(f"  Path: {path}")
        print(f"  Initialized: {initialized}")
        print("")
PYTHON
SCRIPT

chmod +x "${BIN_DIR}/openmemory-list"
echo -e "${GREEN}✓ openmemory-list created${NC}"

# Copy openmemory-watch script
if [ -f "${TEMPLATE_DIR}/enforcement/watcher/openmemory-watch" ]; then
    cp "${TEMPLATE_DIR}/enforcement/watcher/openmemory-watch" "${BIN_DIR}/openmemory-watch"
    chmod +x "${BIN_DIR}/openmemory-watch"
    echo -e "${GREEN}✓ openmemory-watch created${NC}"
else
    echo -e "${YELLOW}⚠ Watcher script not found (optional feature)${NC}"
fi

echo -e "${GREEN}✓ All management scripts created${NC}"

# Create watcher configuration
echo ""
echo "Creating watcher configuration..."
cat > "${WATCHER_DIR}/config.json" <<'EOF'
{
  "_comment": "OpenMemory + AI Agents - Watcher Configuration",
  "watchPaths": [
    "~/Projects",
    "~/Development",
    "~/Code",
    "~/workspace"
  ],
  "ignorePatterns": [
    "node_modules",
    ".git",
    "dist",
    "build",
    ".next",
    "__pycache__",
    "venv",
    ".venv"
  ],
  "checkIntervalMs": 30000,
  "autoInitialize": true,
  "requireGit": true,
  "_help": {
    "watchPaths": "Directories to watch for new projects (use absolute paths or ~)",
    "ignorePatterns": "Directory names to ignore",
    "checkIntervalMs": "How often to scan for new projects (milliseconds)",
    "autoInitialize": "Automatically initialize detected projects",
    "requireGit": "Only detect directories that are git repositories"
  }
}
EOF

# Expand ~ in watch paths
python3 <<PYTHON
import json
import os
from pathlib import Path

config_file = Path("${WATCHER_DIR}/config.json")
config = json.loads(config_file.read_text())

# Expand ~ in watch paths
expanded_paths = []
for p in config["watchPaths"]:
    expanded = os.path.expanduser(p)
    expanded_paths.append(expanded)

config["watchPaths"] = expanded_paths
config_file.write_text(json.dumps(config, indent=2))
PYTHON

echo -e "${GREEN}✓ Watcher configuration created${NC}"

# Add to PATH
echo ""
echo "Adding to PATH..."

SHELL_RC=""
if [ -f "${HOME}/.bashrc" ]; then
    SHELL_RC="${HOME}/.bashrc"
elif [ -f "${HOME}/.zshrc" ]; then
    SHELL_RC="${HOME}/.zshrc"
fi

if [ -n "${SHELL_RC}" ]; then
    if ! grep -q "${BIN_DIR}" "${SHELL_RC}"; then
        echo "" >> "${SHELL_RC}"
        echo "# OpenMemory + AI Agents Global System" >> "${SHELL_RC}"
        echo "export PATH=\"${BIN_DIR}:\$PATH\"" >> "${SHELL_RC}"
        echo -e "${GREEN}✓ Added to ${SHELL_RC}${NC}"
        echo -e "${YELLOW}  Run: source ${SHELL_RC}${NC}"
    else
        echo -e "${GREEN}✓ Already in PATH${NC}"
    fi
fi

# Mark as installed
echo "${TIMESTAMP}" > "${GLOBAL_DIR}/.installed"

# Print summary
echo ""
echo -e "${GREEN}=====================================================================${NC}"
echo -e "${GREEN}✅ INSTALLATION COMPLETE${NC}"
echo -e "${GREEN}=====================================================================${NC}"
echo ""
echo "Global system installed at: ${GLOBAL_DIR}"
echo ""
echo "Available commands:"
echo "  openmemory-init [dir]    Initialize new project"
echo "  openmemory-start         Start OpenMemory backend"
echo "  openmemory-status        Show system status"
echo "  openmemory-list          List all projects"
echo "  openmemory-watch         Project auto-detection watcher"
echo ""
echo "Quick start:"
echo "  1. Start backend: openmemory-start"
echo "  2. (Optional) Start watcher: openmemory-watch start"
echo "  3. In new project: openmemory-init"
echo "  4. Start coding - enforcement is active!"
echo ""
echo "Auto-detection (optional):"
echo "  The watcher can automatically detect and initialize new projects."
echo "  • Start: openmemory-watch start"
echo "  • Status: openmemory-watch status"
echo "  • Configure: ${WATCHER_DIR}/config.json"
echo ""
echo "For VS Code integration, install: OpenMemory Extension (coming soon)"
echo ""
echo -e "${YELLOW}⚠ Remember to run: source ${SHELL_RC:-~/.bashrc}${NC}"
echo ""

exit 0
