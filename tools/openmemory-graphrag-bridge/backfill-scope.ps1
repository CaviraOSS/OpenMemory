param(
    [string[]]$DocumentIds,
    [int]$Limit = 1000,
    [switch]$DryRun,
    [string]$BridgeUrl = 'http://127.0.0.1:8765',
    [string]$BridgeApiKey
)

$ErrorActionPreference = 'Stop'

if (-not $BridgeApiKey) {
    $BridgeApiKey = docker inspect openmemory-graphrag-bridge-1 --format '{{range .Config.Env}}{{println .}}{{end}}' `
        | Select-String '^OM_GRAPHRAG_BRIDGE_API_KEY=' `
        | ForEach-Object { ($_ -split '=', 2)[1] } `
        | Select-Object -First 1
}

if (-not $BridgeApiKey) {
    throw 'OM_GRAPHRAG_BRIDGE_API_KEY not found. Pass -BridgeApiKey explicitly or start openmemory-graphrag-bridge-1 first.'
}

$headers = @{
    'x-graph-api-key' = $BridgeApiKey
    'Content-Type' = 'application/json'
}

$payload = @{
    dry_run = [bool]$DryRun
    limit = $Limit
    document_ids = @($DocumentIds | Where-Object { $_ -and $_.Trim() })
}

Invoke-RestMethod `
    -Uri ($BridgeUrl.TrimEnd('/') + '/scope/backfill') `
    -Method Post `
    -Headers $headers `
    -Body ($payload | ConvertTo-Json -Depth 6)
