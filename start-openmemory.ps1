$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Opm = Join-Path $Root "packages\openmemory-js\bin\opm.js"
$DataDir = Join-Path $Root "data"
$LogDir = Join-Path $Root "logs"
$DbPath = Join-Path $DataDir "openmemory.sqlite"
$Stdout = Join-Path $LogDir "openmemory-server.log"
$Stderr = Join-Path $LogDir "openmemory-server.err.log"

function Test-OpenMemoryHealth {
    try {
        $response = Invoke-RestMethod -Uri "http://127.0.0.1:8080/health" -TimeoutSec 3
        return [bool]$response.ok
    } catch {
        return $false
    }
}

if (Test-OpenMemoryHealth) {
    return
}

if (-not (Test-Path -LiteralPath $Opm)) {
    throw "OpenMemory CLI missing at $Opm. Run npm install in packages\openmemory-js."
}

New-Item -ItemType Directory -Force -Path $DataDir, $LogDir | Out-Null

$env:OPENMEMORY_URL = "http://127.0.0.1:8080"
$env:OM_PORT = "8080"
$env:OM_DB_PATH = $DbPath
$env:OM_TIER = "hybrid"
$env:NO_COLOR = "1"

Start-Process `
    -FilePath $Node `
    -ArgumentList @("`"$Opm`"", "serve") `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $Stdout `
    -RedirectStandardError $Stderr | Out-Null

$deadline = (Get-Date).AddSeconds(20)
while ((Get-Date) -lt $deadline) {
    if (Test-OpenMemoryHealth) {
        return
    }
    Start-Sleep -Milliseconds 500
}

throw "OpenMemory did not become healthy on http://127.0.0.1:8080/health. Check $Stdout and $Stderr."
