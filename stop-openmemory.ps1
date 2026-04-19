$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Opm = Join-Path $Root "packages\openmemory-js\bin\opm.js"
$escapedRoot = [regex]::Escape($Root)
$escapedOpm = [regex]::Escape($Opm)

$processes = Get-CimInstance Win32_Process |
    Where-Object {
        ($_.CommandLine -match $escapedOpm -or $_.CommandLine -match $escapedRoot) -and
        $_.CommandLine -match "opm\.js" -and
        $_.CommandLine -match "\bserve\b"
    }

foreach ($process in $processes) {
    if ($process.ProcessId -ne $PID) {
        Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
    }
}
