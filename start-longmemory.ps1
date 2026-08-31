#      __                      __  ___
#     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
#    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
#   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
#  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
#                      /____/                                 /____/
#
#  cavira oss (c) 2026  -  nullure (c) 2026
#  ----------------------------------------------------------
#  file  : start-longmemory.ps1
#  usage : supports LongMemory start longmemory

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Node = (Get-Command node.exe -ErrorAction Stop).Source
$Entry = Join-Path $Root 'dist\cli\index.js'
$State = Join-Path $Root '.longmemory'
$Database = Join-Path $State 'server.db'
$Stdout = Join-Path $State 'server.log'
$Stderr = Join-Path $State 'server.err.log'

function Test-LongMemoryHealth {
    try {
        $health = Invoke-RestMethod -Uri 'http://127.0.0.1:7331/health' -TimeoutSec 3
        return [bool]$health.ready
    } catch {
        return $false
    }
}

if (Test-LongMemoryHealth) {
    Write-Host 'LongMemory is already healthy at http://127.0.0.1:7331'
    return
}
if (-not (Test-Path -LiteralPath $Entry)) {
    throw 'LongMemory is not built. Run pnpm install and pnpm build first.'
}

New-Item -ItemType Directory -Force -Path $State | Out-Null
$env:LONGMEMORY_DB_PATH = $Database
$env:LONGMEMORY_HOST = '127.0.0.1'
$env:LONGMEMORY_PORT = '7331'
$env:LONGMEMORY_MCP_HTTP = 'true'
$env:NO_COLOR = '1'

Start-Process -FilePath $Node `
    -ArgumentList @("`"$Entry`"", 'serve', '--mcp-http') `
    -WorkingDirectory $Root `
    -WindowStyle Hidden `
    -RedirectStandardOutput $Stdout `
    -RedirectStandardError $Stderr | Out-Null

$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
    if (Test-LongMemoryHealth) {
        Write-Host 'LongMemory started at http://127.0.0.1:7331'
        return
    }
    Start-Sleep -Milliseconds 500
}
throw "LongMemory did not become healthy. Check $Stdout and $Stderr."
