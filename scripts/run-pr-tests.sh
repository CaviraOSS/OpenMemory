#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/test-results"
STAMP="$(date -u +"%Y%m%dT%H%M%SZ")"
RUN_DIR="${LOG_DIR}/pr112-${STAMP}"
LOG_FILE="${RUN_DIR}/run.log"
REPORT_FILE="${LOG_DIR}/PR112-validation-report.md"

mkdir -p "${RUN_DIR}"

exec > >(tee -a "${LOG_FILE}") 2>&1

echo "[pr-tests] start: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "[pr-tests] repo: ${ROOT_DIR}"
echo "[pr-tests] run_dir: ${RUN_DIR}"

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

pick_free_port() {
  python3 - <<'PY'
import socket
for port in range(18081, 18151):
    s = socket.socket()
    try:
        s.bind(("127.0.0.1", port))
        print(port)
        raise SystemExit(0)
    except OSError:
        continue
    finally:
        try:
            s.close()
        except Exception:
            pass
raise SystemExit("no free port in range 18081-18150")
PY
}

expect_http_code() {
  local want="$1"
  local got="$2"
  local label="$3"
  if [[ "${got}" != "${want}" ]]; then
    echo "[pr-tests] ❌ ${label}: expected HTTP ${want}, got ${got}" >&2
    return 1
  fi
  echo "[pr-tests] ✅ ${label}: HTTP ${got}"
}

extract_mcp_session_id() {
  local headers_file="$1"
  python3 - <<'PY' "${headers_file}"
import re, sys
headers = open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read().splitlines()
for line in headers:
    m = re.match(r"(?i)^mcp-session-id:\\s*(.+?)\\s*$", line.strip())
    if m:
        print(m.group(1).strip())
        raise SystemExit(0)
print("")
raise SystemExit(0)
PY
}

json_extract() {
  local file="$1"
  local expr="$2"
  python3 - <<'PY' "${file}" "${expr}"
import json, sys
data = json.load(open(sys.argv[1], "r", encoding="utf-8"))
expr = sys.argv[2].strip()

def get_path(obj, path):
    cur = obj
    for part in path.split("."):
        if part.endswith("]"):
            name, idx = part[:-1].split("[", 1)
            if name:
                cur = cur[name]
            cur = cur[int(idx)]
        else:
            cur = cur[part]
    return cur

val = get_path(data, expr)
if isinstance(val, (dict, list)):
    print(json.dumps(val))
else:
    print(val)
PY
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

run_mcp_http_smoke() {
  local image_tag="$1"

  local api_key="pr112-test-key"
  local default_user="pr112-user"
  local host_port
  host_port="$(pick_free_port)"

  local container_port="18080"
  local container_name="openmemory-pr112-${STAMP}"
  local volume_name="openmemory-pr112-data-${STAMP}"

  section "Run container for MCP/HTTP smoke (port ${host_port} -> ${container_port})"
  echo "[pr-tests] building/running with api_key=${api_key} default_user=${default_user}"

  # Persist identifiers outside of function scope because EXIT traps run
  # after locals are unset (macOS bash + set -u).
  PRTEST_CONTAINER_NAME="${container_name}"
  PRTEST_VOLUME_NAME="${volume_name}"

  docker volume create "${volume_name}" >/dev/null

  cleanup() {
    if [[ "${KEEP_DOCKER:-}" == "1" ]]; then
      echo "[pr-tests] KEEP_DOCKER=1 set; skipping container/volume cleanup"
      return
    fi
    if [[ -n "${PRTEST_CONTAINER_NAME:-}" ]]; then
      docker rm -f "${PRTEST_CONTAINER_NAME}" >/dev/null 2>&1 || true
    fi
    if [[ -n "${PRTEST_VOLUME_NAME:-}" ]]; then
      docker volume rm -f "${PRTEST_VOLUME_NAME}" >/dev/null 2>&1 || true
    fi
  }
  trap cleanup EXIT

  docker run -d --rm \
    --name "${container_name}" \
    -e "OM_PORT=${container_port}" \
    -e "OM_API_KEY=${api_key}" \
    -e "OM_DEFAULT_USER_ID=${default_user}" \
    -e "OM_USE_SUMMARY_ONLY=false" \
    -e "OM_MAX_PAYLOAD_SIZE=1048576" \
    -e "OM_MODE=standard" \
    -e "OM_TIER=hybrid" \
    -e "OM_EMBEDDINGS=synthetic" \
    -e "OM_EMBEDDING_FALLBACK=synthetic" \
    -e "OM_METADATA_BACKEND=sqlite" \
    -e "OM_VECTOR_BACKEND=sqlite" \
    -e "OM_DB_PATH=/data/openmemory.sqlite" \
    -v "${volume_name}:/data" \
    -p "${host_port}:${container_port}" \
    "${image_tag}" >/dev/null

  local base="http://127.0.0.1:${host_port}"

  section "Wait for /health"
  local deadline=$((SECONDS + 60))
  until curl -fsS "${base}/health" >/dev/null 2>&1; do
    if (( SECONDS > deadline )); then
      echo "[pr-tests] ❌ healthcheck timeout; container logs:" >&2
      docker logs "${container_name}" >&2 || true
      exit 1
    fi
    sleep 1
  done
  curl -fsS "${base}/health" | tee "${RUN_DIR}/health.json" >/dev/null
  echo "[pr-tests] ✅ healthy: ${base}"

  section "Auth required (HTTP)"
  local code
  code="$(curl -sS -o /dev/null -w "%{http_code}" "${base}/memory/all")"
  expect_http_code "401" "${code}" "GET /memory/all without key"

  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${api_key}" "${base}/memory/all")"
  expect_http_code "200" "${code}" "GET /memory/all with key"

  section "HTTP CRUD: add/get/patch/delete"
  curl -sS -H "Content-Type: application/json" -H "x-api-key: ${api_key}" \
    --data "$(python3 - <<'PY'
import json
print(json.dumps({
  "content": "http-add-content",
  "tags": ["pr112", "http"],
  "metadata": {"source": "pr112-run-pr-tests"},
  "user_id": "pr112-user",
}))
PY
)" \
    "${base}/memory/add" | tee "${RUN_DIR}/http-memory-add.json" >/dev/null

  local http_id
  http_id="$(python3 - <<'PY' "${RUN_DIR}/http-memory-add.json"
import json, sys
data = json.load(open(sys.argv[1]))
print(data["id"])
PY
)"
  echo "[pr-tests] http memory id: ${http_id}"

  curl -sS -H "x-api-key: ${api_key}" \
    "${base}/memory/${http_id}?user_id=${default_user}" | tee "${RUN_DIR}/http-memory-get.json" >/dev/null

  curl -sS -X PATCH -H "Content-Type: application/json" -H "x-api-key: ${api_key}" \
    --data "$(python3 - <<'PY'
import json
print(json.dumps({
  "content": "http-updated-content",
  "tags": ["pr112", "http", "updated"],
  "metadata": {"source": "pr112-run-pr-tests", "updated": True},
  "user_id": "pr112-user",
}))
PY
)" \
    "${base}/memory/${http_id}" | tee "${RUN_DIR}/http-memory-patch.json" >/dev/null

  curl -sS -H "x-api-key: ${api_key}" \
    "${base}/memory/${http_id}?user_id=${default_user}" | tee "${RUN_DIR}/http-memory-get-after-patch.json" >/dev/null

  local http_content
  http_content="$(python3 - <<'PY' "${RUN_DIR}/http-memory-get-after-patch.json"
import json, sys
data = json.load(open(sys.argv[1]))
print(data.get("content",""))
PY
)"
  if [[ "${http_content}" != "http-updated-content" ]]; then
    echo "[pr-tests] ❌ HTTP PATCH did not update content (got '${http_content}')" >&2
    exit 1
  fi
  echo "[pr-tests] ✅ HTTP PATCH updated content"

  curl -sS -X DELETE -H "x-api-key: ${api_key}" \
    "${base}/memory/${http_id}?user_id=${default_user}" | tee "${RUN_DIR}/http-memory-delete.json" >/dev/null

  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${api_key}" "${base}/memory/${http_id}?user_id=${default_user}")"
  expect_http_code "404" "${code}" "GET /memory/:id after delete"

  section "MCP transport: GET /mcp (SSE headers)"
  set +e
  curl -sS -D "${RUN_DIR}/mcp-sse.headers" -o /dev/null \
    --max-time 2 \
    -H "Accept: text/event-stream" \
    -H "x-api-key: ${api_key}" \
    "${base}/mcp"
  local curl_rc=$?
  set -e
  if [[ "${curl_rc}" -ne 0 && "${curl_rc}" -ne 18 && "${curl_rc}" -ne 28 ]]; then
    echo "[pr-tests] ❌ SSE probe curl failed with rc=${curl_rc}" >&2
    exit 1
  fi

  python3 - <<'PY' "${RUN_DIR}/mcp-sse.headers"
import sys
hdr = open(sys.argv[1], "r", encoding="utf-8", errors="ignore").read().lower()
assert "200" in hdr.splitlines()[0]
assert "content-type:" in hdr
assert "text/event-stream" in hdr
print("ok")
PY
  echo "[pr-tests] ✅ SSE headers OK"

  section "MCP initialize + tools/list"
  curl -sS -D "${RUN_DIR}/mcp-init.headers" -o "${RUN_DIR}/mcp-init.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    --data "$(python3 - <<'PY'
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":1,
  "method":"initialize",
  "params":{
    "protocolVersion":"2024-11-05",
    "capabilities":{},
    "clientInfo":{"name":"pr112-run-pr-tests","version":"0.0.0"}
  }
}))
PY
)" \
    "${base}/mcp"

  local mcp_sid
  mcp_sid="$(extract_mcp_session_id "${RUN_DIR}/mcp-init.headers")"
  if [[ -n "${mcp_sid}" ]]; then
    echo "[pr-tests] mcp-session-id: ${mcp_sid}"
  else
    echo "[pr-tests] mcp-session-id: (none; stateless transport)"
  fi

  mcp_session_header() {
    if [[ -n "${mcp_sid}" ]]; then
      printf '%s\n' "-H" "mcp-session-id: ${mcp_sid}"
    fi
  }

  curl -sS -D "${RUN_DIR}/mcp-tools.headers" -o "${RUN_DIR}/mcp-tools.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
    "${base}/mcp"

  python3 - <<'PY' "${RUN_DIR}/mcp-tools.json"
import json, sys
data = json.load(open(sys.argv[1]))
names = [t["name"] for t in data["result"]["tools"]]
need = ["openmemory_store","openmemory_query","openmemory_list","openmemory_get","openmemory_reinforce","openmemory_update","openmemory_delete"]
missing = [n for n in need if n not in names]
if missing:
    raise SystemExit("missing tools: " + ", ".join(missing))
print("ok")
PY
  echo "[pr-tests] ✅ tools/list includes update/delete"

  section "MCP: store (default user_id from env) -> get -> update -> get -> reinforce -> delete -> get"
  curl -sS -o "${RUN_DIR}/mcp-store.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<'PY'
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":3,
  "method":"tools/call",
  "params":{
    "name":"openmemory_store",
    "arguments":{
      "content":"mcp-store-content",
      "tags":["pr112","mcp"],
      "metadata":{"source":"pr112-run-pr-tests"}
    }
  }
}))
PY
)" \
    "${base}/mcp"

  local mcp_store_json
  mcp_store_json="$(json_extract "${RUN_DIR}/mcp-store.json" "result.content[1].text")"
  echo "${mcp_store_json}" > "${RUN_DIR}/mcp-store.payload.json"
  local mcp_id
  mcp_id="$(python3 - <<'PY' "${RUN_DIR}/mcp-store.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
print(payload["hsg"]["id"])
PY
)"
  local mcp_user
  mcp_user="$(python3 - <<'PY' "${RUN_DIR}/mcp-store.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
print(payload.get("user_id") or "")
PY
)"
  echo "[pr-tests] stored mcp id: ${mcp_id} (user_id='${mcp_user}')"
  if [[ "${mcp_user}" != "${default_user}" ]]; then
    echo "[pr-tests] ❌ MCP default user_id mismatch (expected '${default_user}', got '${mcp_user}')" >&2
    exit 1
  fi
  echo "[pr-tests] ✅ MCP store used default user_id"

  curl -sS -o "${RUN_DIR}/mcp-get.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":4,
  "method":"tools/call",
  "params":{"name":"openmemory_get","arguments":{"id":"${mcp_id}"}}
}))
PY
)" \
    "${base}/mcp"

  local mcp_get_payload
  mcp_get_payload="$(json_extract "${RUN_DIR}/mcp-get.json" "result.content[0].text")"
  echo "${mcp_get_payload}" > "${RUN_DIR}/mcp-get.payload.json"
  python3 - <<'PY' "${RUN_DIR}/mcp-get.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
assert payload["content"] == "mcp-store-content"
print("ok")
PY
  echo "[pr-tests] ✅ MCP get returned full content"

  section "MCP: large content is not truncated (OM_USE_SUMMARY_ONLY=false)"
  python3 - <<'PY' > "${RUN_DIR}/mcp-big-content.txt"
tail = "<<<TAIL-MUST-SURVIVE>>>"
print(("x" * 20000) + tail)
PY

  curl -sS -o "${RUN_DIR}/mcp-store-big.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
big = open("${RUN_DIR}/mcp-big-content.txt", "r").read()
print(json.dumps({
  "jsonrpc":"2.0",
  "id":41,
  "method":"tools/call",
  "params":{
    "name":"openmemory_store",
    "arguments":{
      "content": big,
      "tags":["pr112","mcp","big"],
      "metadata":{"source":"pr112-run-pr-tests","kind":"big"}
    }
  }
}))
PY
)" \
    "${base}/mcp"

  local mcp_big_store_json
  mcp_big_store_json="$(json_extract "${RUN_DIR}/mcp-store-big.json" "result.content[1].text")"
  echo "${mcp_big_store_json}" > "${RUN_DIR}/mcp-store-big.payload.json"
  local mcp_big_id
  mcp_big_id="$(python3 - <<'PY' "${RUN_DIR}/mcp-store-big.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
print(payload["hsg"]["id"])
PY
)"

  curl -sS -o "${RUN_DIR}/mcp-get-big.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":42,
  "method":"tools/call",
  "params":{"name":"openmemory_get","arguments":{"id":"${mcp_big_id}"}}
}))
PY
)" \
    "${base}/mcp"

  local mcp_big_payload
  mcp_big_payload="$(json_extract "${RUN_DIR}/mcp-get-big.json" "result.content[0].text")"
  echo "${mcp_big_payload}" > "${RUN_DIR}/mcp-get-big.payload.json"
  python3 - <<'PY' "${RUN_DIR}/mcp-get-big.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
content = payload["content"]
assert content.rstrip("\n").endswith("<<<TAIL-MUST-SURVIVE>>>")
assert len(content) > 20000
print("ok")
PY
  echo "[pr-tests] ✅ MCP get preserved big content tail"

  curl -sS -o "${RUN_DIR}/mcp-delete-big.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":43,
  "method":"tools/call",
  "params":{"name":"openmemory_delete","arguments":{"id":"${mcp_big_id}"}}
}))
PY
)" \
    "${base}/mcp"

  curl -sS -o "${RUN_DIR}/mcp-update.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":5,
  "method":"tools/call",
  "params":{
    "name":"openmemory_update",
    "arguments":{
      "id":"${mcp_id}",
      "content":"mcp-updated-content",
      "tags":["pr112","mcp","updated"],
      "metadata":{"source":"pr112-run-pr-tests","updated":True}
    }
  }
}))
PY
)" \
    "${base}/mcp"

  curl -sS -o "${RUN_DIR}/mcp-get-after-update.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":6,
  "method":"tools/call",
  "params":{"name":"openmemory_get","arguments":{"id":"${mcp_id}"}}
}))
PY
)" \
    "${base}/mcp"

  local mcp_get2_payload
  mcp_get2_payload="$(json_extract "${RUN_DIR}/mcp-get-after-update.json" "result.content[0].text")"
  echo "${mcp_get2_payload}" > "${RUN_DIR}/mcp-get-after-update.payload.json"
  python3 - <<'PY' "${RUN_DIR}/mcp-get-after-update.payload.json"
import json, sys
payload = json.loads(open(sys.argv[1]).read())
assert payload["content"] == "mcp-updated-content"
assert payload["metadata"]["updated"] is True
assert "updated" in payload["tags"]
print("ok")
PY
  echo "[pr-tests] ✅ MCP update applied (content/tags/metadata)"

  curl -sS -o "${RUN_DIR}/mcp-reinforce.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":7,
  "method":"tools/call",
  "params":{"name":"openmemory_reinforce","arguments":{"id":"${mcp_id}","boost":0.2}}
}))
PY
)" \
    "${base}/mcp"

  curl -sS -o "${RUN_DIR}/mcp-delete.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":8,
  "method":"tools/call",
  "params":{"name":"openmemory_delete","arguments":{"id":"${mcp_id}"}}
}))
PY
)" \
    "${base}/mcp"

  curl -sS -o "${RUN_DIR}/mcp-get-after-delete.json" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    --data "$(python3 - <<PY
import json
print(json.dumps({
  "jsonrpc":"2.0",
  "id":9,
  "method":"tools/call",
  "params":{"name":"openmemory_get","arguments":{"id":"${mcp_id}"}}
}))
PY
)" \
    "${base}/mcp"

  local after_delete_text
  after_delete_text="$(json_extract "${RUN_DIR}/mcp-get-after-delete.json" "result.content[0].text")"
  if [[ "${after_delete_text}" != *"not found"* ]]; then
    echo "[pr-tests] ❌ MCP get after delete did not report not found" >&2
    echo "[pr-tests] payload: ${after_delete_text}" >&2
    exit 1
  fi
  echo "[pr-tests] ✅ MCP delete removed memory"

  section "MCP transport: DELETE /mcp closes session"
  code="$(curl -sS -o /dev/null -w "%{http_code}" -X DELETE \
    -H "Accept: application/json, text/event-stream" \
    -H "x-api-key: ${api_key}" \
    $(mcp_session_header) \
    "${base}/mcp")"
  if [[ "${code}" != "200" && "${code}" != "204" ]]; then
    echo "[pr-tests] ❌ DELETE /mcp unexpected HTTP ${code}" >&2
    exit 1
  fi
  echo "[pr-tests] ✅ DELETE /mcp returned HTTP ${code}"

  section "Persistence: restart container keeps stored memories"
  curl -sS -H "Content-Type: application/json" -H "x-api-key: ${api_key}" \
    --data "$(python3 - <<'PY'
import json
print(json.dumps({
  "content": "persistence-check-content",
  "tags": ["pr112", "persist"],
  "metadata": {"source": "pr112-run-pr-tests"},
  "user_id": "pr112-user",
}))
PY
)" \
    "${base}/memory/add" | tee "${RUN_DIR}/persist-add.json" >/dev/null
  local persist_id
  persist_id="$(python3 - <<'PY' "${RUN_DIR}/persist-add.json"
import json, sys
data = json.load(open(sys.argv[1]))
print(data["id"])
PY
)"

  docker rm -f "${container_name}" >/dev/null
  docker run -d --rm \
    --name "${container_name}" \
    -e "OM_PORT=${container_port}" \
    -e "OM_API_KEY=${api_key}" \
    -e "OM_DEFAULT_USER_ID=${default_user}" \
    -e "OM_USE_SUMMARY_ONLY=false" \
    -e "OM_MAX_PAYLOAD_SIZE=1048576" \
    -e "OM_MODE=standard" \
    -e "OM_TIER=hybrid" \
    -e "OM_EMBEDDINGS=synthetic" \
    -e "OM_EMBEDDING_FALLBACK=synthetic" \
    -e "OM_METADATA_BACKEND=sqlite" \
    -e "OM_VECTOR_BACKEND=sqlite" \
    -e "OM_DB_PATH=/data/openmemory.sqlite" \
    -v "${volume_name}:/data" \
    -p "${host_port}:${container_port}" \
    "${image_tag}" >/dev/null

  deadline=$((SECONDS + 60))
  until curl -fsS "${base}/health" >/dev/null 2>&1; do
    if (( SECONDS > deadline )); then
      echo "[pr-tests] ❌ healthcheck timeout after restart; container logs:" >&2
      docker logs "${container_name}" >&2 || true
      exit 1
    fi
    sleep 1
  done

  code="$(curl -sS -o /dev/null -w "%{http_code}" -H "x-api-key: ${api_key}" "${base}/memory/${persist_id}?user_id=${default_user}")"
  expect_http_code "200" "${code}" "GET /memory/:id after restart (persistence)"

  curl -sS -H "x-api-key: ${api_key}" \
    "${base}/memory/${persist_id}?user_id=${default_user}" | tee "${RUN_DIR}/persist-get-after-restart.json" >/dev/null

  python3 - <<'PY' "${RUN_DIR}/persist-get-after-restart.json"
import json, sys
data = json.load(open(sys.argv[1]))
assert data.get("content") == "persistence-check-content"
print("ok")
PY
  echo "[pr-tests] ✅ persistence content verified"
}

write_report() {
  section "Write Markdown report"
  local big_len="unknown"
  if [[ -f "${RUN_DIR}/mcp-big-content.txt" ]]; then
    big_len="$(python3 -c "print(len(open('${RUN_DIR}/mcp-big-content.txt','r').read()))")"
  fi
  {
    echo "# PR112 Validation Report"
    echo
    echo "- Generated (UTC): $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
    echo "- Repo: ${ROOT_DIR}"
    echo "- Commit: $(git -C "${ROOT_DIR}" rev-parse HEAD)"
    echo "- Script: scripts/run-pr-tests.sh"
    echo "- Run dir: ${RUN_DIR}"
    echo
    echo "## Test Script (full)"
    echo
    echo "\`\`\`bash"
    cat "${ROOT_DIR}/scripts/run-pr-tests.sh"
    echo "\`\`\`"
    echo
    echo "## What Was Tested"
    echo
    echo "### SDK (containerized)"
    echo "- Node SDK omnibus: build + tests/test_omnibus.ts"
    echo "- Python SDK omnibus: pytest tests/test_omnibus.py"
    echo
    echo "### Service (Docker image)"
    echo "- Build image from packages/openmemory-js/Dockerfile"
    echo "- Start container + /health"
    echo "- Auth required for HTTP API"
    echo "- HTTP CRUD: /memory/add, /memory/:id (GET/PATCH/DELETE)"
    echo "- MCP transport: GET SSE headers, POST JSON-RPC, DELETE /mcp"
    echo "- MCP tools: tools/list includes update/delete; store/get/update/reinforce/delete flow"
    echo "- Default user_id from OM_DEFAULT_USER_ID for MCP calls without user_id"
    echo "- Persistence: restart container with same volume keeps data"
    echo
    echo "## Results (artifacts)"
    echo
    echo "- Log: ${LOG_FILE}"
    echo "- Directory with captured responses: ${RUN_DIR}/"
    echo
    echo "### Health"
    echo "\`\`\`json"
    cat "${RUN_DIR}/health.json"
    echo "\`\`\`"
    echo
    echo "### HTTP CRUD"
    echo "**Add** \`${RUN_DIR}/http-memory-add.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/http-memory-add.json"
    echo "\`\`\`"
    echo
    echo "**Get (before patch)** \`${RUN_DIR}/http-memory-get.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/http-memory-get.json"
    echo "\`\`\`"
    echo
    echo "**Patch** \`${RUN_DIR}/http-memory-patch.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/http-memory-patch.json"
    echo "\`\`\`"
    echo
    echo "**Get (after patch)** \`${RUN_DIR}/http-memory-get-after-patch.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/http-memory-get-after-patch.json"
    echo "\`\`\`"
    echo
    echo "**Delete** \`${RUN_DIR}/http-memory-delete.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/http-memory-delete.json"
    echo "\`\`\`"
    echo
    echo "### MCP (SSE headers probe)"
    echo "\`\`\`text"
    sed -n '1,30p' "${RUN_DIR}/mcp-sse.headers"
    echo "\`\`\`"
    echo
    echo "### MCP initialize"
    echo "**Headers** \`${RUN_DIR}/mcp-init.headers\`"
    echo "\`\`\`text"
    sed -n '1,50p' "${RUN_DIR}/mcp-init.headers"
    echo "\`\`\`"
    echo
    echo "**Body** \`${RUN_DIR}/mcp-init.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-init.json"
    echo "\`\`\`"
    echo
    echo "### MCP tools/list"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-tools.json"
    echo "\`\`\`"
    echo
    echo "### MCP store/get/update/delete (small content)"
    echo "**Store response** \`${RUN_DIR}/mcp-store.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-store.json"
    echo "\`\`\`"
    echo
    echo "**Store payload (parsed)** \`${RUN_DIR}/mcp-store.payload.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-store.payload.json"
    echo "\`\`\`"
    echo
    echo "**Get payload (parsed)** \`${RUN_DIR}/mcp-get.payload.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-get.payload.json"
    echo "\`\`\`"
    echo
    echo "**Update response** \`${RUN_DIR}/mcp-update.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-update.json"
    echo "\`\`\`"
    echo
    echo "**Get-after-update payload (parsed)** \`${RUN_DIR}/mcp-get-after-update.payload.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-get-after-update.payload.json"
    echo "\`\`\`"
    echo
    echo "**Reinforce response** \`${RUN_DIR}/mcp-reinforce.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-reinforce.json"
    echo "\`\`\`"
    echo
    echo "**Delete response** \`${RUN_DIR}/mcp-delete.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-delete.json"
    echo "\`\`\`"
    echo
    echo "**Get-after-delete response** \`${RUN_DIR}/mcp-get-after-delete.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/mcp-get-after-delete.json"
    echo "\`\`\`"
    echo
    echo "### MCP large content (truncation regression check)"
    echo "- Stored content length: ${big_len}"
    echo "- Retrieved payload file (contains full content): ${RUN_DIR}/mcp-get-big.payload.json"
    echo "- Store response: ${RUN_DIR}/mcp-store-big.json"
    echo "- Get response: ${RUN_DIR}/mcp-get-big.json"
    echo
    echo "### Persistence (volume survives restart)"
    echo "**Add** \`${RUN_DIR}/persist-add.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/persist-add.json"
    echo "\`\`\`"
    echo
    echo "**Get after restart** \`${RUN_DIR}/persist-get-after-restart.json\`"
    echo "\`\`\`json"
    cat "${RUN_DIR}/persist-get-after-restart.json"
    echo "\`\`\`"
    echo
    echo "## How To Reproduce"
    echo
    echo "\`\`\`bash"
    echo "scripts/run-pr-tests.sh"
    echo "\`\`\`"
  } > "${REPORT_FILE}"
  echo "[pr-tests] ✅ report: ${REPORT_FILE}"
}

section "Versions"
require_cmd git
require_cmd python3
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

section "MCP/HTTP Smoke (Docker image)"
require_cmd curl
run_mcp_http_smoke "openmemory-prtest:local"

write_report

section "Done"
echo "[pr-tests] ✅ all checks passed"
echo "[pr-tests] log: ${LOG_FILE}"
echo "[pr-tests] report: ${REPORT_FILE}"
