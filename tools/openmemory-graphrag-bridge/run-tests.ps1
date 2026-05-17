param(
    [switch]$RebuildImage
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

docker run --rm `
    -v "${toolRoot}:/app" `
    -e "PYTHONWARNINGS=ignore:Support for class-based \`config\` is deprecated" `
    --entrypoint python `
    $image `
    /app/tests/test_server_logic.py
if ($LASTEXITCODE -ne 0) {
    Write-Error "test_server_logic.py failed with exit code $LASTEXITCODE"
    exit $LASTEXITCODE
}
