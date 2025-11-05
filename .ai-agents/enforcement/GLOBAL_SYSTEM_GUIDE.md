# OpenMemory + AI Agents - Global System Guide

This guide explains the **centralized global system** that allows one OpenMemory installation to manage multiple projects.

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Installation](#installation)
4. [Usage](#usage)
5. [Auto-Detection Watcher](#auto-detection-watcher)
6. [Managing Multiple Projects](#managing-multiple-projects)
7. [Configuration](#configuration)
8. [Troubleshooting](#troubleshooting)
9. [Advanced Topics](#advanced-topics)

---

## Overview

### The Problem

**Traditional per-project installation:**
```
~/Projects/ProjectA/.ai-agents/     ← Duplicate
~/Projects/ProjectB/.ai-agents/     ← Duplicate
~/Projects/ProjectC/.ai-agents/     ← Duplicate
```

- Multiple copies of the same system
- Difficult to update
- Clutters project directories
- Separate backend for each project

### The Solution

**Centralized global system:**
```
~/.openmemory-global/               ← ONE installation
├── backend/                        ← ONE backend for all projects
├── ai-agents-template/             ← ONE template
└── projects/                       ← Registry of all projects

~/Projects/ProjectA/.openmemory     ← 3-line link file
~/Projects/ProjectB/.openmemory     ← 3-line link file
~/Projects/ProjectC/.openmemory     ← 3-line link file
```

**Benefits:**
- ✅ One installation manages all projects
- ✅ Projects stay clean (only 3-line link file)
- ✅ Easy to update (update once, affects all)
- ✅ Shared backend for all projects
- ✅ Centralized monitoring and logging
- ✅ Auto-detection of new projects
- ✅ Works with empty folders in VS Code

---

## Architecture

### Directory Structure

```
~/.openmemory-global/
├── .installed                      # Installation timestamp
├── backend/                        # OpenMemory backend server
│   ├── backend/                    # Actual backend code
│   │   ├── .env                    # Configuration
│   │   ├── src/
│   │   └── package.json
│   └── .ai-agents/                 # Backend's own .ai-agents
├── ai-agents-template/             # Master template for all projects
│   ├── config.json                 # Default configuration
│   ├── enforcement/
│   │   ├── git-hooks/
│   │   │   └── pre-commit-validator.sh
│   │   ├── watchdog.ts
│   │   ├── schemas.ts
│   │   └── watcher/
│   │       ├── project-watcher.ts
│   │       └── openmemory-watch
│   └── ...
├── projects/                       # Project registry and data
│   ├── registry.json               # List of all managed projects
│   ├── ProjectA/
│   │   ├── state.json
│   │   └── hook-executions.log
│   ├── ProjectB/
│   └── ProjectC/
├── watcher/                        # Auto-detection service
│   ├── config.json                 # Watcher configuration
│   ├── watcher.log                 # Watcher logs
│   └── watcher.pid                 # Watcher process ID
└── bin/                            # Management scripts (in PATH)
    ├── openmemory-init             # Initialize new project
    ├── openmemory-start            # Start backend
    ├── openmemory-status           # Show system status
    ├── openmemory-list             # List all projects
    └── openmemory-watch            # Watcher control
```

### Project Structure (Clean!)

```
~/Projects/MyProject/               # Your actual project
├── .git/                           # Git repository
│   └── hooks/
│       └── pre-commit              # Calls global validator
├── .openmemory                     # 3-line link file (ONLY addition)
├── src/                            # Your code
├── package.json                    # Your dependencies
└── ...                             # Your files
```

**The `.openmemory` file:**
```bash
GLOBAL_DIR=/home/user/.openmemory-global
PROJECT_NAME=MyProject
OPENMEMORY_URL=http://localhost:8080
```

That's it! Just 3 lines.

---

## Installation

### Step 1: Install Global System

**Option A: Direct Installation (Recommended)**

```bash
# Clone OpenMemory repository
git clone https://github.com/caviraoss/openmemory.git
cd openmemory

# Run global installation
./.ai-agents/enforcement/install-global.sh
```

**Option B: One-Line Installation**

```bash
curl -sSL https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/install-global.sh | bash
```

**What gets installed:**
- OpenMemory backend at `~/.openmemory-global/backend`
- AI agents template at `~/.openmemory-global/ai-agents-template`
- Management scripts in `~/.openmemory-global/bin` (added to PATH)
- Project registry at `~/.openmemory-global/projects/registry.json`
- Watcher configuration at `~/.openmemory-global/watcher/config.json`

**Installation output:**
```
=====================================================================
OpenMemory + AI Agents - Global Installation
=====================================================================

Checking requirements...
✓ Node.js v20.10.0
✓ npm 10.2.5
✓ git version 2.34.1
✓ Python 3.11.0

Creating global directory structure...
✓ Directories created

Installing OpenMemory backend...
✓ Backend installed

Creating project management scripts...
✓ openmemory-init created
✓ openmemory-start created
✓ openmemory-status created
✓ openmemory-list created
✓ openmemory-watch created

Creating watcher configuration...
✓ Watcher configuration created

Adding to PATH...
✓ Added to /home/user/.bashrc

=====================================================================
✅ INSTALLATION COMPLETE
=====================================================================

Available commands:
  openmemory-init [dir]    Initialize new project
  openmemory-start         Start OpenMemory backend
  openmemory-status        Show system status
  openmemory-list          List all projects
  openmemory-watch         Project auto-detection watcher

Quick start:
  1. Start backend: openmemory-start
  2. (Optional) Start watcher: openmemory-watch start
  3. In new project: openmemory-init
  4. Start coding - enforcement is active!

⚠ Remember to run: source ~/.bashrc
```

### Step 2: Reload Shell

```bash
# Reload your shell configuration
source ~/.bashrc  # or source ~/.zshrc
```

### Step 3: Verify Installation

```bash
# Check if commands are available
which openmemory-init
which openmemory-start
which openmemory-watch

# Check system status
openmemory-status
```

**Expected output:**
```
======================================================================
OpenMemory + AI Agents - Global System Status
======================================================================

Installation: /home/user/.openmemory-global

✗ Backend: Not running (start with: openmemory-start)

Registered projects:
----------------------------------------------------------------------
  No projects registered yet.
```

---

## Usage

### Starting the Backend

The backend **must be running** for full functionality:

```bash
# Start backend
openmemory-start
```

Output:
```
Starting OpenMemory backend...
Access at: http://localhost:8080
Press Ctrl+C to stop

> openmemory@0.1.0 dev
> tsx watch --ignore-path .gitignore src/server/index.ts

OpenMemory server is running on http://localhost:8080

✓ AI Agent Enforcement Middleware enabled
✓ Validation endpoints initialized
✓ Enforcement Watchdog started
```

**Keep this terminal open** or run in background:
```bash
# Run in background
nohup openmemory-start > ~/openmemory.log 2>&1 &
```

### Initializing a New Project

**Scenario 1: Existing Project**

```bash
# Navigate to your project
cd ~/Projects/MyExistingProject

# Initialize OpenMemory + AI agents
openmemory-init
```

**Scenario 2: New Empty Project**

```bash
# Create new project folder
mkdir ~/Projects/MyNewProject
cd ~/Projects/MyNewProject

# Initialize (will also create git repo if needed)
openmemory-init
```

**Scenario 3: VS Code Empty Folder**

1. Open VS Code
2. File → Open Folder → Create new folder "MyProject"
3. Open terminal in VS Code
4. Run: `openmemory-init`

**Initialization output:**
```
=====================================================================
Initializing OpenMemory + AI Agents for: MyProject
=====================================================================

✓ Git repository initialized
✓ Created .openmemory link file
Installing git hooks...
✓ Git hooks installed
Registering project...
✓ Project registered

=====================================================================
✅ Project initialized successfully!
=====================================================================

Project: MyProject
Location: /home/user/Projects/MyProject
Global system: /home/user/.openmemory-global

Next steps:
  1. Start OpenMemory backend: openmemory-start
  2. Begin coding - the system is active!
  3. All actions will be tracked automatically
```

**What happened:**
1. Created `.openmemory` link file (3 lines)
2. Installed git pre-commit hook
3. Registered project in global registry
4. Created project directory in `~/.openmemory-global/projects/MyProject/`

---

## Auto-Detection Watcher

The watcher automatically detects and initializes new projects.

### How It Works

```
1. You create: ~/Projects/NewProject/
2. You run: git init
3. You add: package.json or requirements.txt
   ↓
4. Watcher detects it (next scan)
   ↓
5. Watcher auto-initializes
   ↓
6. Project is ready! ✓
```

### Starting the Watcher

**Manual start:**
```bash
openmemory-watch start
```

Output:
```
=====================================================================
OpenMemory + AI Agents - Project Auto-Detection Watcher
=====================================================================

✓ Watcher starting...
  Global directory: /home/user/.openmemory-global
  Check interval: 30 seconds
  Auto-initialize: true

Watch paths:
  ✓ /home/user/Projects
  ✓ /home/user/Development
  ✓ /home/user/Code
  ✗ /home/user/workspace (doesn't exist)

✓ Watcher is now monitoring for new projects
  Press Ctrl+C to stop
=====================================================================
```

**Check status:**
```bash
openmemory-watch status
```

Output:
```
=====================================================================
OpenMemory Project Watcher Status
=====================================================================

Status: RUNNING
PID: 12345

Memory: 45MB

Recent activity:
----------------------------------------
  2025-11-05T10:30:00Z - INITIALIZED - MyProject (/home/user/Projects/MyProject)
  2025-11-05T10:35:00Z - SCAN - No new projects
  2025-11-05T10:40:00Z - SCAN - No new projects

Configuration:
  Global directory: /home/user/.openmemory-global
  Watcher script: /home/user/.openmemory-global/ai-agents-template/enforcement/watcher/project-watcher.ts
  Log file: /home/user/.openmemory-global/watcher/watcher.log

Watch paths:
  "/home/user/Projects",
  "/home/user/Development",
  "/home/user/Code"
```

**Stop watcher:**
```bash
openmemory-watch stop
```

**Restart watcher:**
```bash
openmemory-watch restart
```

### Installing as System Service

For automatic startup on boot:

```bash
# Install as system service
~/.openmemory-global/ai-agents-template/enforcement/watcher/install-service.sh
```

**On Linux (systemd):**
```bash
# Service is now installed and enabled
systemctl --user status openmemory-watcher
systemctl --user start openmemory-watcher
systemctl --user stop openmemory-watcher

# View logs
journalctl --user -u openmemory-watcher -f
```

**On macOS (launchd):**
```bash
# Service is now installed and loaded
launchctl list | grep openmemory
launchctl start com.openmemory.watcher
launchctl stop com.openmemory.watcher
```

### Watcher Configuration

Edit `~/.openmemory-global/watcher/config.json`:

```json
{
  "_comment": "OpenMemory + AI Agents - Watcher Configuration",
  "watchPaths": [
    "/home/user/Projects",
    "/home/user/Development",
    "/home/user/Code",
    "/home/user/workspace"
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
  "requireGit": true
}
```

**Settings:**
- `watchPaths` - Directories to monitor for new projects
- `ignorePatterns` - Directory names to skip
- `checkIntervalMs` - Scan frequency (30000 = 30 seconds)
- `autoInitialize` - Automatically initialize detected projects
- `requireGit` - Only detect git repositories

**After editing, restart:**
```bash
openmemory-watch restart
```

---

## Managing Multiple Projects

### Listing Projects

```bash
openmemory-list
```

Output:
```
Registered projects: 3

MyProjectA
  Status: active
  Path: /home/user/Projects/MyProjectA
  Initialized: 2025-11-05T10:00:00Z

MyProjectB
  Status: active
  Path: /home/user/Projects/MyProjectB
  Initialized: 2025-11-05T11:30:00Z

MyProjectC
  Status: active
  Path: /home/user/Projects/MyProjectC
  Initialized: 2025-11-05T14:15:00Z
```

### System Status

```bash
openmemory-status
```

Output:
```
======================================================================
OpenMemory + AI Agents - Global System Status
======================================================================

Installation: /home/user/.openmemory-global

✓ Backend: Running (http://localhost:8080)

Registered projects:
----------------------------------------------------------------------
  • MyProjectA (active)
    /home/user/Projects/MyProjectA
  • MyProjectB (active)
    /home/user/Projects/MyProjectB
  • MyProjectC (active)
    /home/user/Projects/MyProjectC
```

### Working with Multiple Projects

**Scenario: Working on 3 projects simultaneously**

1. **Start backend once:**
   ```bash
   openmemory-start  # Runs in one terminal
   ```

2. **Work on Project A:**
   ```bash
   cd ~/Projects/ProjectA
   git commit -m "feat: add feature"  # ✓ Validated by global system
   ```

3. **Switch to Project B:**
   ```bash
   cd ~/Projects/ProjectB
   git commit -m "fix: bug fix"  # ✓ Validated by same global system
   ```

4. **Switch to Project C:**
   ```bash
   cd ~/Projects/ProjectC
   git commit -m "docs: update"  # ✓ Validated by same global system
   ```

All projects use the **same backend**, **same enforcement**, **same validation**.

---

## Configuration

### Global Configuration

Located at: `~/.openmemory-global/ai-agents-template/config.json`

This is the **default configuration** for all projects:

```json
{
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
```

Changes to this file affect **all new projects** (not existing ones).

### Per-Project Configuration

Projects can override global settings by creating `.ai-agents/config.json`:

```bash
cd ~/Projects/MyProject
mkdir -p .ai-agents
cp ~/.openmemory-global/ai-agents-template/config.json .ai-agents/config.json

# Edit for project-specific settings
nano .ai-agents/config.json
```

Project-specific config takes precedence over global config.

### Backend Configuration

Located at: `~/.openmemory-global/backend/backend/.env`

```env
PORT=8080
DATABASE_URL=postgresql://...
ANTHROPIC_API_KEY=...
```

Edit this file to change backend settings.

---

## Troubleshooting

### Backend Not Running

**Problem:** `openmemory-status` shows backend not running.

**Solution:**
```bash
# Start backend
openmemory-start

# Or check if port is already in use
lsof -i :8080
```

### Hook Validation Fails

**Problem:** Commits are blocked by pre-commit hook.

**Check:**
1. Is backend running? `openmemory-status`
2. Is `.openmemory` file present? `cat .openmemory`
3. Check hook log: `cat ~/.openmemory-global/projects/MyProject/hook-executions.log`

**Quick fix:**
```bash
# Ensure backend is running
openmemory-start

# Or enable fallback in project config
```

### Watcher Not Detecting Projects

**Problem:** Watcher is running but not detecting new projects.

**Check:**
1. Are watch paths correct? `cat ~/.openmemory-global/watcher/config.json`
2. Is project a git repo? `git status` in project directory
3. Does project have indicators? (package.json, requirements.txt, etc.)
4. Check watcher log: `tail -f ~/.openmemory-global/watcher/watcher.log`

**Fix:**
```bash
# Verify watcher is running
openmemory-watch status

# Check configuration
nano ~/.openmemory-global/watcher/config.json

# Restart watcher
openmemory-watch restart
```

### Command Not Found

**Problem:** `openmemory-init: command not found`

**Solution:**
```bash
# Reload shell configuration
source ~/.bashrc  # or source ~/.zshrc

# Or add manually
export PATH="$HOME/.openmemory-global/bin:$PATH"
```

### Project Not Registered

**Problem:** Initialized project but not in registry.

**Solution:**
```bash
# Re-initialize the project
cd ~/Projects/MyProject
openmemory-init

# Or check registry manually
cat ~/.openmemory-global/projects/registry.json
```

---

## Advanced Topics

### Multiple OpenMemory Installations

You can have multiple global installations (e.g., one for personal, one for work):

```bash
# Personal installation (default)
~/.openmemory-global/

# Work installation
~/.openmemory-work/
```

Set environment variable to switch:
```bash
export OPENMEMORY_GLOBAL_DIR=~/.openmemory-work
openmemory-init  # Uses work installation
```

### Custom Backend URL

Projects can use different backend URLs:

```bash
# Edit project's .openmemory file
nano .openmemory

# Change OPENMEMORY_URL
OPENMEMORY_URL=http://my-server:8080
```

### Backup and Migration

**Backup global system:**
```bash
# Backup everything
tar -czf openmemory-backup.tar.gz ~/.openmemory-global/

# Backup just project data
tar -czf projects-backup.tar.gz ~/.openmemory-global/projects/
```

**Migrate to new machine:**
```bash
# On new machine
tar -xzf openmemory-backup.tar.gz -C ~/

# Update paths in shell config
echo 'export PATH="$HOME/.openmemory-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Uninstallation

**Remove from single project:**
```bash
cd ~/Projects/MyProject
rm .openmemory
rm .git/hooks/pre-commit
```

**Remove global system:**
```bash
# Remove directory
rm -rf ~/.openmemory-global

# Remove from PATH
nano ~/.bashrc  # Remove the export PATH line
```

---

## Summary

The global system provides:

✅ **One installation** manages unlimited projects
✅ **Clean project directories** (only 3-line link file)
✅ **Automatic detection** of new projects
✅ **Centralized monitoring** and enforcement
✅ **Easy updates** (update once, affects all)
✅ **Works with empty folders** in VS Code
✅ **True enforcement** that cannot be bypassed

**Key Commands:**
- `openmemory-init` - Initialize new project
- `openmemory-start` - Start backend
- `openmemory-status` - Show system status
- `openmemory-list` - List all projects
- `openmemory-watch start` - Start auto-detection

**Architecture:**
```
ONE Global System → Manages ALL Projects → Enforces on EVERY Commit
```

For more information, see:
- Main README: `/home/user/OpenMemory/README.md`
- Enforcement README: `~/.openmemory-global/ai-agents-template/enforcement/README.md`
- Git Hooks README: `~/.openmemory-global/ai-agents-template/enforcement/git-hooks/README.md`
