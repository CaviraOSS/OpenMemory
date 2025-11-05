# Setting Up AI Agent Enforcement for Any Project

This guide explains how to install the AI Agent Enforcement System in **any project**, not just OpenMemory.

## Quick Start

### Option 1: Automated Installation (Recommended)

```bash
# From your project root:
curl -sSL https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/install-in-project.sh | bash
```

### Option 2: Manual Installation

```bash
# 1. Clone or copy the enforcement system
cd your-project
mkdir -p .ai-agents/enforcement

# 2. Copy enforcement files from OpenMemory
cp -r path/to/OpenMemory/.ai-agents/enforcement/* .ai-agents/enforcement/

# 3. Run installation
.ai-agents/enforcement/git-hooks/install-hooks.sh

# 4. Verify installation
ls -la .git/hooks/pre-commit
```

### Option 3: Initialize from Scratch

```bash
# 1. Create .ai-agents directory structure
mkdir -p .ai-agents/enforcement/git-hooks

# 2. Download required files
cd .ai-agents/enforcement

# Download from OpenMemory repository
wget https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/git-hooks/pre-commit
wget https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/git-hooks/install-hooks.sh

chmod +x git-hooks/*.sh git-hooks/pre-commit

# 3. Run installation
./git-hooks/install-hooks.sh
```

## What Gets Installed

The enforcement system adds these files to your project:

```
your-project/
├── .ai-agents/
│   ├── config.json                      # Auto-created if missing
│   ├── enforcement-status.json          # Auto-generated
│   └── enforcement/
│       ├── README.md                    # Documentation
│       ├── git-hooks/
│       │   ├── pre-commit              # Git hook (copied to .git/hooks/)
│       │   ├── install-hooks.sh        # Installation script
│       │   └── hook-executions.log     # Execution log
│       ├── schemas.ts                   # Schema definitions (optional)
│       ├── auto-init.ts                 # Auto-init (optional)
│       └── watchdog.ts                  # Watchdog (optional)
└── .git/
    └── hooks/
        └── pre-commit                   # Active hook (auto-installed)
```

## Minimum Requirements

For the git hooks to work, your project only needs:

### Required Files:
1. **`.ai-agents/config.json`** - Configuration (auto-created if missing)
2. **`.ai-agents/enforcement/git-hooks/pre-commit`** - The hook script
3. **`.git/hooks/pre-commit`** - Copy of the hook (installed automatically)

### Optional But Recommended:
- OpenMemory server running (or `fallback_to_local: true` in config)
- Project state files (`project-state.json`, etc.)
- Full enforcement system (middleware, watchdog, schemas)

## Configuration

### Minimal config.json

The installation creates this automatically:

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

### Configuration Options

| Option | Description | Default |
|--------|-------------|---------|
| `openmemory.enabled` | Use OpenMemory for storage | `true` |
| `openmemory.fallback_to_local` | Use local files if OpenMemory unavailable | `true` |
| `enforcement.git_hooks_enabled` | Enable git hook enforcement | `true` |
| `enforcement.strict_mode` | Block commits on any warning | `false` |

## Integration with OpenMemory

### If You Have OpenMemory Running:

The hooks will automatically:
- ✅ Verify OpenMemory connection
- ✅ Check for recent agent activity
- ✅ Run validation endpoints
- ✅ Ensure actions are recorded

### If You Don't Have OpenMemory:

Set `fallback_to_local: true` in config.json:
- ✅ Hooks will use local file validation
- ✅ State files checked locally
- ✅ Basic validation still enforced
- ⚠️ Some advanced features unavailable

## How It Works

### On Every Commit:

```
Developer/AI runs: git commit -m "message"
        ↓
Pre-commit hook executes automatically
        ↓
Validates:
  ✓ .ai-agents system exists
  ✓ OpenMemory accessible (or fallback enabled)
  ✓ Staged files analyzed
  ✓ Recent agent activity present
  ✓ State files updated (for code changes)
  ✓ Autonomous mode compliance
        ↓
[PASS] → Commit proceeds
        ↓
[FAIL] → Commit BLOCKED with violation details
```

## For Different Project Types

### TypeScript/JavaScript Projects

```bash
# Install enforcement
.ai-agents/enforcement/git-hooks/install-hooks.sh

# Optional: Add to package.json
{
  "scripts": {
    "postinstall": ".ai-agents/enforcement/git-hooks/install-hooks.sh"
  }
}
```

### Python Projects

```bash
# Install enforcement
./.ai-agents/enforcement/git-hooks/install-hooks.sh

# Optional: Add to setup.py or requirements
# Run install script after pip install
```

### Any Other Project

```bash
# Just install the hooks - they're language-agnostic
./.ai-agents/enforcement/git-hooks/install-hooks.sh
```

## Emergency Bypass

**Not recommended but available:**

```bash
# Bypass hook for one commit (logged and monitored)
AI_AGENT_HOOK_BYPASS=true git commit -m "emergency commit"
```

Bypasses are:
- ⚠️ Logged to `hook-executions.log`
- ⚠️ Monitored by watchdog (if running)
- ⚠️ Reported in enforcement status
- ⚠️ Should only be used in true emergencies

## Uninstallation

To remove enforcement:

```bash
# Remove git hooks
rm .git/hooks/pre-commit

# Optional: Remove enforcement system
rm -rf .ai-agents/enforcement

# Optional: Remove all .ai-agents
rm -rf .ai-agents
```

## Troubleshooting

### Hook Not Running

```bash
# Check if hook is executable
ls -la .git/hooks/pre-commit

# Should show: -rwxr-xr-x

# If not:
chmod +x .git/hooks/pre-commit
```

### Hook Blocking Valid Commits

```bash
# Check the specific violation
git commit -m "test"
# Read the error message carefully

# Common fixes:
# 1. Ensure config.json exists
# 2. Set fallback_to_local: true if OpenMemory not running
# 3. Check hook execution log for details
cat .ai-agents/enforcement/git-hooks/hook-executions.log
```

### OpenMemory Connection Failed

```bash
# Option 1: Start OpenMemory
cd path/to/OpenMemory/backend
npm run dev

# Option 2: Enable fallback in config.json
{
  "openmemory": {
    "fallback_to_local": true
  }
}
```

## Advanced: Full Stack Installation

For the complete enforcement system (not just git hooks):

```bash
# 1. Install git hooks
./.ai-agents/enforcement/git-hooks/install-hooks.sh

# 2. Copy full enforcement directory from OpenMemory
cp -r path/to/OpenMemory/.ai-agents/enforcement/* .ai-agents/enforcement/

# 3. Copy backend middleware (if you have a backend)
mkdir -p backend/src/server/middleware
cp path/to/OpenMemory/backend/src/server/middleware/ai-agent-enforcement.ts \
   backend/src/server/middleware/

# 4. Start enforcement watchdog (if desired)
ts-node .ai-agents/enforcement/watchdog.ts
```

## Example: New Project Setup

```bash
#!/bin/bash
# setup-ai-agent-enforcement.sh

# 1. Initialize git (if not already)
git init

# 2. Create .ai-agents structure
mkdir -p .ai-agents/enforcement/git-hooks

# 3. Download enforcement files
curl -o .ai-agents/enforcement/git-hooks/pre-commit \
  https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/git-hooks/pre-commit

curl -o .ai-agents/enforcement/git-hooks/install-hooks.sh \
  https://raw.githubusercontent.com/YOUR_ORG/OpenMemory/main/.ai-agents/enforcement/git-hooks/install-hooks.sh

chmod +x .ai-agents/enforcement/git-hooks/*

# 4. Install hooks
./.ai-agents/enforcement/git-hooks/install-hooks.sh

echo "✅ AI Agent Enforcement installed!"
```

## Sharing Across Organization

### Create a Template Repository

```bash
# 1. Create template repo
mkdir ai-agent-enforcement-template
cd ai-agent-enforcement-template

# 2. Copy enforcement system
cp -r path/to/OpenMemory/.ai-agents .

# 3. Add README
cat > README.md <<EOF
# AI Agent Enforcement Template

Use this template to add AI agent enforcement to any project.

## Quick Start
\`\`\`bash
./.ai-agents/enforcement/git-hooks/install-hooks.sh
\`\`\`
EOF

# 4. Commit and push
git init
git add .
git commit -m "Initial enforcement template"
git remote add origin git@github.com:YOUR_ORG/ai-agent-enforcement.git
git push -u origin main
```

### Use Template in New Projects

```bash
# Add as git submodule
git submodule add https://github.com/YOUR_ORG/ai-agent-enforcement .ai-agents

# Or copy files
curl -sSL https://github.com/YOUR_ORG/ai-agent-enforcement/archive/main.tar.gz | tar xz
mv ai-agent-enforcement-main/.ai-agents .

# Install
./.ai-agents/enforcement/git-hooks/install-hooks.sh
```

## Verification

After installation, verify everything works:

```bash
# 1. Check hook exists and is executable
ls -la .git/hooks/pre-commit

# 2. Check config exists
cat .ai-agents/config.json

# 3. Test hook (without committing)
.git/hooks/pre-commit

# 4. Check enforcement status
cat .ai-agents/enforcement-status.json

# 5. Make a test commit
echo "test" > test.txt
git add test.txt
git commit -m "test: verify enforcement"

# Should see validation output
```

## Support

- Documentation: `.ai-agents/enforcement/README.md`
- Hook logs: `.ai-agents/enforcement/git-hooks/hook-executions.log`
- Issues: GitHub Issues for OpenMemory project

## Summary

The AI Agent Enforcement System can be installed in **any project** with just:

1. Copy enforcement files to `.ai-agents/enforcement/`
2. Run `install-hooks.sh`
3. Configure `config.json` (auto-created if missing)

This ensures AI agents **cannot bypass validation** in any project using git.
