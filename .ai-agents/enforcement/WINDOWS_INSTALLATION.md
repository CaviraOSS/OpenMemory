# OpenMemory + AI Agents - Windows Installation Guide

This guide provides Windows-specific installation instructions for the OpenMemory global system.

## Requirements

- **Windows 10 or higher**
- **PowerShell 5.1 or higher** (included with Windows)
- **Node.js 20+** - [Download](https://nodejs.org/)
- **Git for Windows** - [Download](https://git-scm.com/download/win)
- **Python 3.8+** (optional but recommended) - [Download](https://www.python.org/downloads/)

## Installation Steps

### 1. Clone the Repository

Open PowerShell and run:

```powershell
cd $env:USERPROFILE\Desktop\Projects  # or wherever you want
git clone https://github.com/caviraoss/openmemory.git
cd openmemory
```

### 2. Run Global Installation Script

```powershell
# Run the PowerShell installation script
.\.ai-agents\enforcement\install-global.ps1
```

**What this does:**
- Creates `%USERPROFILE%\.openmemory-global\` directory
- Installs OpenMemory backend
- Creates management PowerShell scripts
- Adds scripts to your PATH
- Sets up project registry

**Installation output:**
```
=====================================================================
OpenMemory + AI Agents - Global Installation (Windows)
=====================================================================

Checking requirements...
✓ Node.js v20.10.0
✓ npm 10.2.5
✓ git version 2.43.0.windows.1
✓ Python 3.11.0

Creating global directory structure...
✓ Directories created

Installing OpenMemory backend...
✓ Backend installed

Creating project management scripts...
✓ openmemory-init.ps1 created
✓ openmemory-start.ps1 created
✓ openmemory-status.ps1 created
✓ openmemory-list.ps1 created

=====================================================================
✅ INSTALLATION COMPLETE
=====================================================================

⚠ IMPORTANT: Close and reopen PowerShell for commands to work
```

### 3. Restart PowerShell

**IMPORTANT:** Close and reopen PowerShell for PATH changes to take effect.

```powershell
# Close PowerShell and open a new window
```

### 4. Verify Installation

```powershell
# Check if commands are available
Get-Command openmemory-init.ps1
Get-Command openmemory-start.ps1

# Or check system status
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-status.ps1"
```

## Using the System

### Start the Backend

```powershell
# Start the OpenMemory backend (keep this window open)
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-start.ps1"
```

Or if PATH is set up:
```powershell
openmemory-start
```

### Initialize a New Project

#### Option 1: New Empty Folder in VS Code

1. Open VS Code
2. File → Open Folder → Create new folder (e.g., "MyNewProject")
3. Open PowerShell terminal in VS Code (`Ctrl+Shift+\``)
4. Run:
   ```powershell
   & "$env:USERPROFILE\.openmemory-global\bin\openmemory-init.ps1"
   ```

#### Option 2: Existing Project

```powershell
cd C:\Users\YourName\Projects\ExistingProject
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-init.ps1"
```

### Check System Status

```powershell
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-status.ps1"
```

Output:
```
======================================================================
OpenMemory + AI Agents - Global System Status
======================================================================

Installation: C:\Users\YourName\.openmemory-global

✓ Backend: Running (http://localhost:8080)

Registered projects:
----------------------------------------------------------------------
  • MyProject (active)
    C:\Users\YourName\Projects\MyProject
```

### List All Projects

```powershell
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-list.ps1"
```

## What Gets Installed

### Global Directory Structure

```
C:\Users\YourName\.openmemory-global\
├── .installed                      # Installation timestamp
├── backend\                        # OpenMemory backend
│   ├── backend\                    # Actual backend code
│   │   ├── .env                    # Configuration
│   │   └── src\
│   └── .ai-agents\                 # Backend's .ai-agents
├── ai-agents-template\             # Template for projects
│   └── enforcement\
│       ├── git-hooks\
│       │   └── pre-commit-validator.sh
│       └── ...
├── projects\                       # Project registry and data
│   ├── registry.json               # All managed projects
│   └── MyProject\                  # Per-project data
├── watcher\                        # Auto-detection config
│   └── config.json
└── bin\                            # Management scripts
    ├── openmemory-init.ps1
    ├── openmemory-start.ps1
    ├── openmemory-status.ps1
    └── openmemory-list.ps1
```

### What Gets Added to Your Projects

Only **one file**:

```
C:\Users\YourName\Projects\MyProject\
├── .git\
│   └── hooks\
│       └── pre-commit             # Bash script (Git for Windows)
├── .openmemory                    # 3-line link file
└── (your project files)
```

The `.openmemory` file:
```
GLOBAL_DIR=C:\Users\YourName\.openmemory-global
PROJECT_NAME=MyProject
OPENMEMORY_URL=http://localhost:8080
```

## PowerShell Execution Policy

If you get an error about execution policy:

```powershell
# Check current policy
Get-ExecutionPolicy

# Set policy to allow local scripts (run as Administrator)
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or bypass for a single script:
```powershell
PowerShell -ExecutionPolicy Bypass -File .\.ai-agents\enforcement\install-global.ps1
```

## Creating Command Aliases (Optional)

To use commands without full paths, add to your PowerShell profile:

```powershell
# Open your profile
notepad $PROFILE

# Add these lines:
function openmemory-init { & "$env:USERPROFILE\.openmemory-global\bin\openmemory-init.ps1" @args }
function openmemory-start { & "$env:USERPROFILE\.openmemory-global\bin\openmemory-start.ps1" @args }
function openmemory-status { & "$env:USERPROFILE\.openmemory-global\bin\openmemory-status.ps1" @args }
function openmemory-list { & "$env:USERPROFILE\.openmemory-global\bin\openmemory-list.ps1" @args }

# Save and reload
. $PROFILE
```

Now you can use:
```powershell
openmemory-init
openmemory-start
openmemory-status
openmemory-list
```

## Git Hooks on Windows

The git pre-commit hooks use **bash scripts**, which work on Windows because:

- Git for Windows includes Git Bash
- Git automatically uses bash to run hook scripts
- The hooks work exactly like on Linux/macOS

No additional setup needed!

## Troubleshooting

### "openmemory-start.ps1 is not recognized"

**Solution 1:** Use full path
```powershell
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-start.ps1"
```

**Solution 2:** Add to PowerShell profile (see above)

**Solution 3:** Restart PowerShell to pick up PATH changes

### "Cannot run scripts on this system"

**Cause:** PowerShell execution policy blocking scripts

**Solution:**
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Backend won't start

**Check Node.js:**
```powershell
node --version  # Should be 20+
```

**Check port 8080:**
```powershell
netstat -ano | findstr :8080
```

If port is in use, kill the process or change the port in `.env`

### Git hooks not working

**Check Git for Windows is installed:**
```powershell
git --version
```

**Check hook file exists:**
```powershell
Get-Content .\.git\hooks\pre-commit
```

**Make sure Git Bash is available:**
```powershell
& "C:\Program Files\Git\bin\bash.exe" --version
```

## Complete Workflow Example

```powershell
# 1. Install (one time)
cd $env:USERPROFILE\Desktop\Projects
git clone https://github.com/caviraoss/openmemory.git
cd openmemory
.\.ai-agents\enforcement\install-global.ps1

# 2. Close and reopen PowerShell

# 3. Start backend (Terminal 1 - keep open)
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-start.ps1"

# 4. Create new project (Terminal 2)
cd $env:USERPROFILE\Desktop\Projects
mkdir MyNewProject
cd MyNewProject

# 5. Initialize OpenMemory
& "$env:USERPROFILE\.openmemory-global\bin\openmemory-init.ps1"

# Output:
# =====================================================
# Initializing OpenMemory + AI Agents for: MyNewProject
# =====================================================
#
# ✓ Git repository initialized
# ✓ Created .openmemory link file
# ✓ Git hooks installed
# ✓ Project registered
#
# ✅ Project initialized successfully!

# 6. Start coding!
echo '{"name": "myproject"}' > package.json
git add .
git commit -m "Initial commit"

# Pre-commit hook validates automatically:
# ✓ Checks OpenMemory connection
# ✓ Validates changes
# ✓ Commit proceeds
```

## VS Code Integration

### Terminal Setup

In VS Code, set PowerShell as default terminal:

1. `Ctrl+Shift+P` → "Terminal: Select Default Profile"
2. Choose "PowerShell"

### Workspace Settings

Create `.vscode\settings.json`:

```json
{
  "terminal.integrated.profiles.windows": {
    "PowerShell": {
      "source": "PowerShell",
      "icon": "terminal-powershell"
    }
  },
  "terminal.integrated.defaultProfile.windows": "PowerShell"
}
```

## Uninstallation

To remove the global system:

```powershell
# Remove directory
Remove-Item -Recurse -Force "$env:USERPROFILE\.openmemory-global"

# Remove from PATH
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
$newPath = $currentPath -replace ";$env:USERPROFILE\\\.openmemory-global\\bin", ""
[Environment]::SetEnvironmentVariable("Path", $newPath, "User")

# Remove from projects
# Just delete the .openmemory file from each project
Remove-Item .openmemory
Remove-Item .git\hooks\pre-commit
```

## Additional Resources

- **Main Documentation:** [README.md](../../README.md)
- **Global System Guide:** [GLOBAL_SYSTEM_GUIDE.md](./GLOBAL_SYSTEM_GUIDE.md)
- **Git Hooks Documentation:** [git-hooks/README.md](./git-hooks/README.md)

## Windows-Specific Notes

### Path Separators

Windows uses backslashes (`\`) in paths, but the `.openmemory` file uses forward slashes for compatibility with Git Bash.

### Line Endings

Git for Windows handles line ending conversion automatically. No configuration needed.

### Performance

On Windows, the watcher service (auto-detection) is not yet implemented. Use manual initialization:

```powershell
openmemory-init
```

### Windows Task Scheduler (Future)

Planned feature to run the backend automatically on login using Windows Task Scheduler.

---

## Summary

✅ **PowerShell installation script** works on Windows 10+
✅ **Git hooks work** via Git for Windows bash
✅ **Management commands** via PowerShell scripts
✅ **VS Code integration** with PowerShell terminal
✅ **Same enforcement** as Linux/macOS

For the **simplest Windows workflow:**

1. Run `install-global.ps1`
2. Restart PowerShell
3. Start backend: `openmemory-start.ps1`
4. Init projects: `openmemory-init.ps1`
5. Code with full enforcement! 🎉
