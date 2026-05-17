param(
    [switch]$RebuildImage,
    [switch]$UseHostOllama
)

$ErrorActionPreference = 'Stop'

$toolRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$image = 'openmemory-graphrag-bridge:latest'

if ($RebuildImage) {
    docker build -t $image $toolRoot | Out-Host
    if ($LASTEXITCODE -ne 0) {
        Write-Error "docker build failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}

$previousMode = $env:OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA
try {
    if ($UseHostOllama) {
        $env:OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA = 'true'
    }
    else {
        Remove-Item Env:OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA -ErrorAction SilentlyContinue
    }

    python "$toolRoot\tests\test_e2e_bridge_stack.py"
    if ($LASTEXITCODE -ne 0) {
        Write-Error "test_e2e_bridge_stack.py failed with exit code $LASTEXITCODE"
        exit $LASTEXITCODE
    }
}
finally {
    if ($null -eq $previousMode) {
        Remove-Item Env:OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA -ErrorAction SilentlyContinue
    }
    else {
        $env:OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA = $previousMode
    }
}
