#
# OpenMemory + AI Agents - Global Installation Script for Windows
#
# This script installs the OpenMemory + AI Agents system globally,
# allowing it to manage multiple projects from a centralized location.
#
# Usage: .\.ai-agents\enforcement\install-global.ps1
#

# Requires PowerShell 5.1 or higher
#Requires -Version 5.1

$ErrorActionPreference = "Stop"

# Colors
function Write-Success { param($msg) Write-Host $msg -ForegroundColor Green }
function Write-Info { param($msg) Write-Host $msg -ForegroundColor Blue }
function Write-Warning { param($msg) Write-Host $msg -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host $msg -ForegroundColor Red }

Write-Info "====================================================================="
Write-Info "OpenMemory + AI Agents - Global Installation (Windows)"
Write-Info "====================================================================="
Write-Host ""

# Configuration
$GLOBAL_DIR = "$env:USERPROFILE\.openmemory-global"
$BACKEND_DIR = "$GLOBAL_DIR\backend"
$TEMPLATE_DIR = "$GLOBAL_DIR\ai-agents-template"
$PROJECTS_DIR = "$GLOBAL_DIR\projects"
$WATCHER_DIR = "$GLOBAL_DIR\watcher"
$BIN_DIR = "$GLOBAL_DIR\bin"

Write-Info "Detected OS: Windows"
Write-Host ""

# Check requirements
Write-Host "Checking requirements..."

# Check Node.js
if (!(Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error "❌ Node.js not found. Please install Node.js 20+ first."
    Write-Host "   Visit: https://nodejs.org/"
    exit 1
}
$nodeVersion = node --version
Write-Success "✓ Node.js $nodeVersion"

# Check npm
if (!(Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "❌ npm not found. Please install npm."
    exit 1
}
$npmVersion = npm --version
Write-Success "✓ npm $npmVersion"

# Check git
if (!(Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "❌ git not found. Please install Git for Windows."
    Write-Host "   Visit: https://git-scm.com/download/win"
    exit 1
}
$gitVersion = git --version
Write-Success "✓ $gitVersion"

# Check Python (optional)
if (Get-Command python -ErrorAction SilentlyContinue) {
    $pythonVersion = python --version
    Write-Success "✓ $pythonVersion"
} else {
    Write-Warning "⚠ Python not found (optional, but recommended for full features)"
}

Write-Host ""

# Create global directory structure
Write-Host "Creating global directory structure..."
New-Item -ItemType Directory -Force -Path $GLOBAL_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BACKEND_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $TEMPLATE_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $PROJECTS_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $WATCHER_DIR | Out-Null
New-Item -ItemType Directory -Force -Path $BIN_DIR | Out-Null
Write-Success "✓ Directories created"

# Check if already installed
if (Test-Path "$GLOBAL_DIR\.installed") {
    Write-Host ""
    Write-Warning "⚠ OpenMemory global system is already installed."
    $response = Read-Host "Reinstall? (y/N)"
    if ($response -ne "y" -and $response -ne "Y") {
        Write-Host "Installation cancelled."
        exit 0
    }
    Write-Host "Reinstalling..."
}

# Clone or update OpenMemory repository
Write-Host ""
Write-Host "Installing OpenMemory backend..."
if (Test-Path "$BACKEND_DIR\.git") {
    Write-Host "Updating existing installation..."
    Push-Location $BACKEND_DIR
    git pull origin main
    Pop-Location
} else {
    Write-Host "Cloning OpenMemory repository..."
    git clone https://github.com/caviraoss/openmemory.git $BACKEND_DIR
}

# Install backend dependencies
Push-Location "$BACKEND_DIR\backend"
Write-Host "Installing backend dependencies..."
npm install --silent
Pop-Location
Write-Success "✓ Backend installed"

# Create .env file if it doesn't exist
if (!(Test-Path "$BACKEND_DIR\backend\.env")) {
    Write-Host "Creating .env configuration..."
    Copy-Item "$BACKEND_DIR\backend\.env.example" "$BACKEND_DIR\backend\.env"
    Write-Success "✓ Configuration created"
}

# Copy AI agents template
Write-Host ""
Write-Host "Installing AI agents template..."
if (Test-Path "$BACKEND_DIR\.ai-agents") {
    Copy-Item -Recurse -Force "$BACKEND_DIR\.ai-agents\*" $TEMPLATE_DIR
    Write-Success "✓ Template installed"
} else {
    Write-Warning "⚠ .ai-agents directory not found in repository"
}

# Create project registry
Write-Host ""
Write-Host "Creating project registry..."
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$registry = @{
    version = "1.0"
    projects = @{}
    created = $timestamp
    updated = $timestamp
} | ConvertTo-Json
$registry | Out-File -FilePath "$PROJECTS_DIR\registry.json" -Encoding UTF8
Write-Success "✓ Registry created"

# Create project management scripts
Write-Host ""
Write-Host "Creating project management scripts..."

# openmemory-init.ps1
@"
# OpenMemory + AI Agents - Project Initializer
param([string]`$ProjectDir = ".")

`$ErrorActionPreference = "Stop"
`$GLOBAL_DIR = "`$env:USERPROFILE\.openmemory-global"
`$PROJECT_DIR = (Resolve-Path `$ProjectDir).Path
`$PROJECT_NAME = Split-Path `$PROJECT_DIR -Leaf

Write-Host "=====================================================================" -ForegroundColor Blue
Write-Host "Initializing OpenMemory + AI Agents for: `$PROJECT_NAME" -ForegroundColor Blue
Write-Host "=====================================================================" -ForegroundColor Blue
Write-Host ""

# Check if git repository
if (!(Test-Path "`$PROJECT_DIR\.git")) {
    Write-Host "⚠ Not a git repository. Initializing..." -ForegroundColor Yellow
    Push-Location `$PROJECT_DIR
    git init
    Pop-Location
    Write-Host "✓ Git repository initialized" -ForegroundColor Green
}

# Create .openmemory link file
`$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
@"
# OpenMemory Global System Link
# This project uses the centralized OpenMemory + AI Agents system
# Global directory: `$GLOBAL_DIR
# Project name: `$PROJECT_NAME
# Initialized: `$timestamp

GLOBAL_DIR=`$GLOBAL_DIR
PROJECT_NAME=`$PROJECT_NAME
OPENMEMORY_URL=http://localhost:8080
"@ | Out-File -FilePath "`$PROJECT_DIR\.openmemory" -Encoding UTF8

Write-Host "✓ Created .openmemory link file" -ForegroundColor Green

# Install git hooks (bash script - works with Git for Windows)
Write-Host "Installing git hooks..."
New-Item -ItemType Directory -Force -Path "`$PROJECT_DIR\.git\hooks" | Out-Null

# Git for Windows includes bash, so we can use bash scripts
@"
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
if [ -f "`${GLOBAL_DIR}/ai-agents-template/enforcement/git-hooks/pre-commit-validator.sh" ]; then
    exec "`${GLOBAL_DIR}/ai-agents-template/enforcement/git-hooks/pre-commit-validator.sh" "`${PROJECT_NAME}" "`${GLOBAL_DIR}"
else
    echo "⚠ WARNING: Global validator not found, skipping validation"
    exit 0
fi
"@ | Out-File -FilePath "`$PROJECT_DIR\.git\hooks\pre-commit" -Encoding UTF8

Write-Host "✓ Git hooks installed" -ForegroundColor Green

# Register project with global system
Write-Host "Registering project..."
`$registryPath = "`$GLOBAL_DIR\projects\registry.json"
`$registry = Get-Content `$registryPath | ConvertFrom-Json
`$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")

if (!`$registry.projects) {
    `$registry.projects = @{}
}

`$registry.projects | Add-Member -NotePropertyName `$PROJECT_NAME -NotePropertyValue @{
    path = `$PROJECT_DIR
    initialized = `$timestamp
    last_active = `$timestamp
    openmemory_user_id = "project-`$PROJECT_NAME"
    status = "active"
} -Force

`$registry.updated = `$timestamp
`$registry | ConvertTo-Json -Depth 10 | Out-File -FilePath `$registryPath -Encoding UTF8

# Create project directory
New-Item -ItemType Directory -Force -Path "`$GLOBAL_DIR\projects\`$PROJECT_NAME" | Out-Null

Write-Host ""
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host "✅ Project initialized successfully!" -ForegroundColor Green
Write-Host "=====================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Project: `$PROJECT_NAME"
Write-Host "Location: `$PROJECT_DIR"
Write-Host "Global system: `$GLOBAL_DIR"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Start OpenMemory backend: openmemory-start"
Write-Host "  2. Begin coding - the system is active!"
Write-Host "  3. All actions will be tracked automatically"
Write-Host ""
"@ | Out-File -FilePath "$BIN_DIR\openmemory-init.ps1" -Encoding UTF8

Write-Success "✓ openmemory-init.ps1 created"

# openmemory-start.ps1
@"
# Start OpenMemory backend server
`$GLOBAL_DIR = "`$env:USERPROFILE\.openmemory-global"
Set-Location "`$GLOBAL_DIR\backend\backend"

Write-Host "Starting OpenMemory backend..."
Write-Host "Access at: http://localhost:8080"
Write-Host "Press Ctrl+C to stop"
Write-Host ""

npm run dev
"@ | Out-File -FilePath "$BIN_DIR\openmemory-start.ps1" -Encoding UTF8

Write-Success "✓ openmemory-start.ps1 created"

# openmemory-status.ps1
@"
# Show status of OpenMemory global system
`$GLOBAL_DIR = "`$env:USERPROFILE\.openmemory-global"
`$REGISTRY = "`$GLOBAL_DIR\projects\registry.json"

Write-Host "======================================================================"
Write-Host "OpenMemory + AI Agents - Global System Status"
Write-Host "======================================================================"
Write-Host ""
Write-Host "Installation: `$GLOBAL_DIR"
Write-Host ""

# Check if backend is running
try {
    `$response = Invoke-WebRequest -Uri "http://localhost:8080/health" -TimeoutSec 2 -UseBasicParsing
    Write-Host "✓ Backend: Running (http://localhost:8080)" -ForegroundColor Green
} catch {
    Write-Host "✗ Backend: Not running (start with: openmemory-start)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Registered projects:"
Write-Host "----------------------------------------------------------------------"

if (Test-Path `$REGISTRY) {
    `$registry = Get-Content `$REGISTRY | ConvertFrom-Json
    if (`$registry.projects.PSObject.Properties.Count -eq 0) {
        Write-Host "  No projects registered yet."
    } else {
        foreach (`$proj in `$registry.projects.PSObject.Properties) {
            `$name = `$proj.Name
            `$info = `$proj.Value
            `$status = `$info.status
            `$path = `$info.path
            Write-Host "  • `$name (`$status)"
            Write-Host "    `$path"
        }
    }
} else {
    Write-Host "  Registry not found."
}

Write-Host ""
"@ | Out-File -FilePath "$BIN_DIR\openmemory-status.ps1" -Encoding UTF8

Write-Success "✓ openmemory-status.ps1 created"

# openmemory-list.ps1
@"
# List all registered projects
`$GLOBAL_DIR = "`$env:USERPROFILE\.openmemory-global"
`$REGISTRY = "`$GLOBAL_DIR\projects\registry.json"

if (Test-Path `$REGISTRY) {
    `$registry = Get-Content `$REGISTRY | ConvertFrom-Json
    `$count = `$registry.projects.PSObject.Properties.Count

    if (`$count -eq 0) {
        Write-Host "No projects registered."
    } else {
        Write-Host "Registered projects: `$count"
        Write-Host ""
        foreach (`$proj in `$registry.projects.PSObject.Properties) {
            `$name = `$proj.Name
            `$info = `$proj.Value
            Write-Host `$name
            Write-Host "  Status: `$(`$info.status)"
            Write-Host "  Path: `$(`$info.path)"
            Write-Host "  Initialized: `$(`$info.initialized)"
            Write-Host ""
        }
    }
} else {
    Write-Host "Registry not found."
}
"@ | Out-File -FilePath "$BIN_DIR\openmemory-list.ps1" -Encoding UTF8

Write-Success "✓ openmemory-list.ps1 created"

Write-Success "✓ All management scripts created"

# Create watcher configuration
Write-Host ""
Write-Host "Creating watcher configuration..."
@{
    "_comment" = "OpenMemory + AI Agents - Watcher Configuration"
    watchPaths = @(
        "$env:USERPROFILE\Projects"
        "$env:USERPROFILE\Documents\Projects"
        "$env:USERPROFILE\Code"
        "$env:USERPROFILE\workspace"
    )
    ignorePatterns = @(
        "node_modules"
        ".git"
        "dist"
        "build"
        ".next"
        "__pycache__"
        "venv"
        ".venv"
    )
    checkIntervalMs = 30000
    autoInitialize = $true
    requireGit = $true
    "_help" = @{
        watchPaths = "Directories to watch for new projects (use absolute paths)"
        ignorePatterns = "Directory names to ignore"
        checkIntervalMs = "How often to scan for new projects (milliseconds)"
        autoInitialize = "Automatically initialize detected projects"
        requireGit = "Only detect directories that are git repositories"
    }
} | ConvertTo-Json -Depth 10 | Out-File -FilePath "$WATCHER_DIR\config.json" -Encoding UTF8

Write-Success "✓ Watcher configuration created"

# Add to PATH
Write-Host ""
Write-Host "Adding to PATH..."

$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$BIN_DIR*") {
    [Environment]::SetEnvironmentVariable("Path", "$currentPath;$BIN_DIR", "User")
    Write-Success "✓ Added to user PATH"
    Write-Warning "  You may need to restart PowerShell for PATH changes to take effect"
} else {
    Write-Success "✓ Already in PATH"
}

# Mark as installed
$timestamp | Out-File -FilePath "$GLOBAL_DIR\.installed" -Encoding UTF8

# Print summary
Write-Host ""
Write-Success "====================================================================="
Write-Success "✅ INSTALLATION COMPLETE"
Write-Success "====================================================================="
Write-Host ""
Write-Host "Global system installed at: $GLOBAL_DIR"
Write-Host ""
Write-Host "Available commands (PowerShell):"
Write-Host "  openmemory-init         Initialize new project"
Write-Host "  openmemory-start        Start OpenMemory backend"
Write-Host "  openmemory-status       Show system status"
Write-Host "  openmemory-list         List all projects"
Write-Host ""
Write-Host "Quick start:"
Write-Host "  1. Restart PowerShell (for PATH update)"
Write-Host "  2. Start backend: openmemory-start"
Write-Host "  3. In new project: openmemory-init"
Write-Host "  4. Start coding - enforcement is active!"
Write-Host ""
Write-Warning "⚠ IMPORTANT: Close and reopen PowerShell for commands to work"
Write-Host ""
