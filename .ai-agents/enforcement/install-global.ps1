#
# OpenMemory + AI Agents - Windows PowerShell Installer
#
# This script runs the bash installation using Git Bash (included with Git for Windows)
#

$ErrorActionPreference = "Stop"

Write-Host "=====================================================================" -ForegroundColor Blue
Write-Host "OpenMemory + AI Agents - Windows Installation" -ForegroundColor Blue
Write-Host "=====================================================================" -ForegroundColor Blue
Write-Host ""

# Check if Git Bash is installed
$gitBashPaths = @(
    "C:\Program Files\Git\bin\bash.exe",
    "C:\Program Files (x86)\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)

$bashPath = $null
foreach ($path in $gitBashPaths) {
    if (Test-Path $path) {
        $bashPath = $path
        break
    }
}

if (-not $bashPath) {
    Write-Host "ERROR: Git Bash not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Git for Windows is required. Please install it from:" -ForegroundColor Yellow
    Write-Host "https://git-scm.com/download/win" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "After installing Git for Windows, run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "Found Git Bash at: $bashPath" -ForegroundColor Green
Write-Host ""

# Get the script directory
$scriptDir = $PSScriptRoot
$bashScript = Join-Path $scriptDir "install-global.sh"

if (-not (Test-Path $bashScript)) {
    Write-Host "ERROR: install-global.sh not found at: $bashScript" -ForegroundColor Red
    exit 1
}

# Convert Windows path to Unix path for bash
$bashScriptUnix = $bashScript -replace '\\', '/' -replace '^([A-Z]):', { "/$(($_.Value[0]).ToString().ToLower())" }

Write-Host "Running bash installation script..." -ForegroundColor Cyan
Write-Host ""

# Run the bash script
& $bashPath -c "$bashScriptUnix"

$exitCode = $LASTEXITCODE

Write-Host ""
if ($exitCode -eq 0) {
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host "Installation completed successfully!" -ForegroundColor Green
    Write-Host "=====================================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "The scripts have been added to your PATH." -ForegroundColor Cyan
    Write-Host ""
    Write-Host "IMPORTANT: You need to reload your shell for PATH changes to take effect." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Available commands (after reloading shell):" -ForegroundColor Cyan
    Write-Host "  openmemory-start         Start OpenMemory backend" -ForegroundColor White
    Write-Host "  openmemory-init          Initialize new project" -ForegroundColor White
    Write-Host "  openmemory-status        Show system status" -ForegroundColor White
    Write-Host "  openmemory-list          List all projects" -ForegroundColor White
    Write-Host ""
    Write-Host "Quick start:" -ForegroundColor Cyan
    Write-Host "  1. Reload your shell: Close and reopen PowerShell or Git Bash" -ForegroundColor White
    Write-Host "  2. Start backend: openmemory-start" -ForegroundColor White
    Write-Host "  3. In new project: openmemory-init" -ForegroundColor White
    Write-Host "  4. Start coding - enforcement is active!" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host "Installation failed with exit code: $exitCode" -ForegroundColor Red
    exit $exitCode
}
