#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/test-results"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
LOG_FILE="${LOG_DIR}/pr-tests-${STAMP}.log"

mkdir -p "${LOG_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[pr-tests] start: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[pr-tests] repo: ${ROOT_DIR}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "[pr-tests] missing required command: $1" >&2
    exit 127
  fi
}

section() {
  echo
  echo "============================================================"
  echo "[pr-tests] $1"
  echo "============================================================"
}

run_in_docker_node() {
  local image="node:22-bullseye"
  docker run --rm \
    -v "${ROOT_DIR}:/repo" \
    -w "/repo/packages/openmemory-js" \
    -e OM_DB_URL="sqlite:///:memory:" \
    -e OM_TIER="fast" \
    -e OM_VEC_DIM="1536" \
    "${image}" \
    bash -lc 'set -euo pipefail; apt-get update -y >/dev/null; apt-get install -y python3 make g++ >/dev/null; node -v; npm -v; npm ci; npm run build; npx tsx tests/test_omnibus.ts'
}

run_in_docker_python() {
  local image="python:3.11"
  docker run --rm \
    -v "${ROOT_DIR}:/repo" \
    -w "/repo/packages/openmemory-py" \
    "${image}" \
    bash -lc 'set -euo pipefail; python --version; pip --version; pip install -e ".[dev]"; pytest tests/test_omnibus.py -v'
}

section "Versions"
require_cmd git
git -C "${ROOT_DIR}" rev-parse HEAD
git -C "${ROOT_DIR}" status -sb

if command -v docker >/dev/null 2>&1; then
  docker version
else
  echo "[pr-tests] docker not found; cannot run containerized tests." >&2
  exit 127
fi

section "Node SDK (packages/openmemory-js)"
run_in_docker_node

section "Python SDK (packages/openmemory-py)"
run_in_docker_python

section "Docker Build (packages/openmemory-js/Dockerfile)"
docker build -t openmemory-prtest:local "${ROOT_DIR}/packages/openmemory-js"

section "Done"
echo "[pr-tests] ✅ all checks passed"
echo "[pr-tests] log: ${LOG_FILE}"

