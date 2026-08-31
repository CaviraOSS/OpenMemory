#      __                      __  ___
#     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
#    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
#   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ /
#  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /
#                      /____/                                 /____/
#
#  cavira oss (c) 2026  -  nullure (c) 2026
#  ----------------------------------------------------------
#  file  : stop-longmemory.ps1
#  usage : supports LongMemory stop longmemory

$ErrorActionPreference = 'Stop'
$Root = [regex]::Escape((Split-Path -Parent $MyInvocation.MyCommand.Path))
$processes = Get-CimInstance Win32_Process | Where-Object {
    $_.CommandLine -match $Root -and
    $_.CommandLine -match 'dist[\\/]cli[\\/]index\.js' -and
    $_.CommandLine -match '\bserve\b'
}

foreach ($process in $processes) {
    if ($process.ProcessId -ne $PID) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
        Write-Host "Stopped LongMemory process $($process.ProcessId)"
    }
}

if (-not $processes) {
    Write-Host 'No repository LongMemory server process was found.'
}
