from __future__ import annotations

import contextlib
import json
import os
import re
import subprocess
import sys
import threading
import time
import urllib.request
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


NETWORK = f"openmemory-e2e-{uuid.uuid4().hex[:8]}"
FALKOR = f"openmemory-e2e-falkor-{uuid.uuid4().hex[:8]}"
BRIDGE = f"openmemory-e2e-bridge-{uuid.uuid4().hex[:8]}"
BRIDGE_KEY = f"e2e-{uuid.uuid4().hex}"
BRIDGE_PORT = 8773
IMAGE = os.environ.get("OPENMEMORY_GRAPHRAG_BRIDGE_IMAGE", "openmemory-graphrag-bridge:latest")
GRAPH_NAME = f"project_astra_e2e_{uuid.uuid4().hex[:8]}"
USE_HOST_OLLAMA = os.environ.get("OPENMEMORY_GRAPHRAG_USE_HOST_OLLAMA", "").lower() in {
    "1",
    "true",
    "yes",
    "on",
}
REQUEST_TIMEOUT = int(
    os.environ.get(
        "OPENMEMORY_GRAPHRAG_E2E_TIMEOUT",
        "300" if USE_HOST_OLLAMA else "120",
    )
)
LLM_MODEL = os.environ.get("OM_GRAPHRAG_LLM_MODEL", "ollama/qwen2.5:1.5b")
EMBED_MODEL = os.environ.get("OM_GRAPHRAG_EMBEDDER_MODEL", "ollama/bge-m3:latest")
EMBED_DIMS = int(os.environ.get("OM_GRAPHRAG_EMBEDDER_DIMENSIONS", "1024"))
HF_CACHE_VOLUME = os.environ.get("OPENMEMORY_GRAPHRAG_HF_CACHE_VOLUME", "openmemory_graphrag_bridge_hf_cache")
HOST_MODE_LLM_MAX_TOKENS = os.environ.get("OPENMEMORY_GRAPHRAG_HOST_LLM_MAX_TOKENS", "256")
_MARKER_PATTERN = re.compile(r"E2E-MARKER-[A-Za-z0-9]+")


def run(cmd: list[str], *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=check, capture_output=True, text=True)


def cleanup() -> None:
    for name in (BRIDGE, FALKOR):
        run(["docker", "rm", "-f", name], check=False)
    run(["docker", "network", "rm", NETWORK], check=False)


def http_json(method: str, url: str, payload: dict | None = None, headers: dict | None = None, timeout: int = 120) -> dict:
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        method=method,
        headers={
            "Content-Type": "application/json",
            **(headers or {}),
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def wait_health(url: str, timeout_s: int = 180) -> dict:
    deadline = time.time() + timeout_s
    last_error = None
    while time.time() < deadline:
        try:
            payload = http_json("GET", url, timeout=20)
            if payload.get("ok"):
                return payload
            last_error = payload
        except Exception as exc:  # pragma: no cover - runtime I/O
            last_error = str(exc)
        time.sleep(2)
    raise RuntimeError(f"health did not become ready: {last_error}")


def wait_gliner_ready(url: str, timeout_s: int = 300) -> dict:
    deadline = time.time() + timeout_s
    last_payload = None
    while time.time() < deadline:
        payload = http_json("GET", url, timeout=20)
        last_payload = payload
        if payload.get("gliner_prewarm_status") in {"ready", "failed"}:
            return payload
        time.sleep(2)
    raise RuntimeError(f"gliner prewarm did not settle: {last_payload}")


class _FakeOllamaHandler(BaseHTTPRequestHandler):
    server_version = "FakeOllama/1.0"
    sys_version = ""

    def log_message(self, format: str, *args: object) -> None:  # pragma: no cover - noisy runtime path
        return

    def _read_json(self) -> dict:
        size = int(self.headers.get("Content-Length", "0"))
        raw = self.rfile.read(size) if size else b"{}"
        return json.loads(raw.decode("utf-8") or "{}")

    def _write_json(self, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self) -> None:  # noqa: N802
        payload = self._read_json()
        if self.path == "/api/embed":
            prompts = payload.get("input", [])
            if isinstance(prompts, str):
                prompts = [prompts]
            dims = int(payload.get("dimensions") or EMBED_DIMS)
            embeddings = []
            for index, prompt in enumerate(prompts):
                vector = [0.0] * dims
                vector[index % dims] = 1.0
                vector[len(str(prompt)) % dims] = 0.5
                embeddings.append(vector)
            self._write_json(
                {
                    "model": payload.get("model", EMBED_MODEL),
                    "embeddings": embeddings,
                    "prompt_eval_count": max(1, sum(len(str(prompt)) for prompt in prompts) // 8),
                }
            )
            return

        if self.path == "/api/chat":
            messages = payload.get("messages", [])
            merged = "\n".join(str(message.get("content", "")) for message in messages if isinstance(message, dict))
            marker_match = _MARKER_PATTERN.search(merged)
            content = f"Marker: {marker_match.group(0)}" if marker_match else merged
            self._write_json(
                {
                    "model": payload.get("model", LLM_MODEL),
                    "message": {
                        "role": "assistant",
                        "content": content,
                    },
                    "done": True,
                    "done_reason": "stop",
                    "prompt_eval_count": max(1, len(merged) // 8),
                    "eval_count": max(1, len(content) // 8),
                }
            )
            return

        if self.path == "/api/generate":
            prompt = str(payload.get("prompt", ""))
            marker_match = _MARKER_PATTERN.search(prompt)
            response = f"Marker: {marker_match.group(0)}" if marker_match else prompt
            self._write_json(
                {
                    "model": payload.get("model", LLM_MODEL),
                    "response": response,
                    "done": True,
                    "done_reason": "stop",
                    "prompt_eval_count": max(1, len(prompt) // 8),
                    "eval_count": max(1, len(response) // 8),
                }
            )
            return

        self.send_error(404, f"Unsupported path: {self.path}")


@contextlib.contextmanager
def fake_ollama_server() -> str:
    server = ThreadingHTTPServer(("0.0.0.0", 0), _FakeOllamaHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://host.docker.internal:{server.server_address[1]}"
    finally:
        server.shutdown()
        thread.join(timeout=10)
        server.server_close()


def main() -> int:
    cleanup()
    server_ctx = contextlib.nullcontext(os.environ.get("OLLAMA_API_BASE", "http://host.docker.internal:11434"))
    if not USE_HOST_OLLAMA:
        server_ctx = fake_ollama_server()

    with server_ctx as ollama_api_base:
        try:
            run(["docker", "network", "create", NETWORK])
            run(["docker", "run", "-d", "--rm", "--name", FALKOR, "--network", NETWORK, "falkordb/falkordb:latest"])
            bridge_cmd = [
                "docker",
                "run",
                "-d",
                "--rm",
                "--name",
                BRIDGE,
                "--network",
                NETWORK,
                "--add-host",
                "host.docker.internal:host-gateway",
                "-p",
                f"127.0.0.1:{BRIDGE_PORT}:8765",
                "-v",
                f"{HF_CACHE_VOLUME}:/root/.cache/huggingface",
                "-e",
                f"FALKORDB_HOST={FALKOR}",
                "-e",
                "FALKORDB_PORT=6379",
                "-e",
                f"OM_GRAPHRAG_BRIDGE_API_KEY={BRIDGE_KEY}",
                "-e",
                f"OM_GRAPHRAG_GRAPH_NAME={GRAPH_NAME}",
                "-e",
                f"OM_GRAPHRAG_LLM_MODEL={LLM_MODEL}",
                "-e",
                f"OM_GRAPHRAG_EMBEDDER_MODEL={EMBED_MODEL}",
                "-e",
                f"OM_GRAPHRAG_EMBEDDER_DIMENSIONS={EMBED_DIMS}",
                "-e",
                f"OLLAMA_API_BASE={ollama_api_base}",
            ]
            if USE_HOST_OLLAMA:
                bridge_cmd.extend(
                    [
                        "-e",
                        "OM_GRAPHRAG_GLINER_PREWARM=true",
                        "-e",
                        "OM_GRAPHRAG_DEBUG_TIMINGS=true",
                        "-e",
                        f"OM_GRAPHRAG_LLM_MAX_TOKENS={HOST_MODE_LLM_MAX_TOKENS}",
                    ]
                )
            else:
                bridge_cmd.extend(
                    [
                        "-e",
                        "OM_GRAPHRAG_GLINER_PREWARM=false",
                        "-e",
                        "OM_GRAPHRAG_TEST_DISABLE_EXTRACTION=true",
                        "-e",
                        "HF_HUB_OFFLINE=1",
                        "-e",
                        "TRANSFORMERS_OFFLINE=1",
                    ]
                )
            bridge_cmd.append(IMAGE)
            run(bridge_cmd)

            health = wait_health(f"http://127.0.0.1:{BRIDGE_PORT}/health")
            assert health["graphrag_available"] is True
            assert health["configured"] is True
            assert health["falkordb_reachable"] is True
            if USE_HOST_OLLAMA:
                health = wait_gliner_ready(f"http://127.0.0.1:{BRIDGE_PORT}/health")
            else:
                assert health["gliner_prewarm_enabled"] is False
                assert health["test_disable_extraction"] is True

            auth_headers = {"x-graph-api-key": BRIDGE_KEY}
            if USE_HOST_OLLAMA:
                auth_headers["x-graph-debug-timings"] = "true"
            doc_id = f"e2e-doc-{uuid.uuid4().hex[:8]}"
            marker = f"E2E-MARKER-{uuid.uuid4().hex[:8]}"

            upsert = http_json(
                "POST",
                f"http://127.0.0.1:{BRIDGE_PORT}/documents/upsert",
                {
                    "document_id": doc_id,
                    "content": f"Project Astra bridge E2E document with marker {marker}.",
                    "metadata": {"source": "codex-e2e"},
                    "user_id": "codex",
                    "project_id": "project-astra-e2e",
                    "finalize": False,
                },
                headers=auth_headers,
                timeout=REQUEST_TIMEOUT,
            )
            assert upsert["ok"] is True

            query = http_json(
                "POST",
                f"http://127.0.0.1:{BRIDGE_PORT}/query",
                {
                    "query": f"What marker is in {doc_id}?",
                    "user_id": "codex",
                    "project_id": "project-astra-e2e",
                    "k": 3,
                    "return_context": True,
                },
                headers=auth_headers,
                timeout=REQUEST_TIMEOUT,
            )
            assert query["ok"] is True
            assert query["scope_enforced"] is True
            assert marker in json.dumps(query)

            delete = http_json(
                "POST",
                f"http://127.0.0.1:{BRIDGE_PORT}/documents/delete",
                {
                    "document_id": doc_id,
                    "finalize": False,
                },
                headers=auth_headers,
                timeout=REQUEST_TIMEOUT,
            )
            assert delete["ok"] is True
            return 0
        except Exception:
            try:
                logs = run(["docker", "logs", "--tail", "200", BRIDGE], check=False)
                sys.stderr.write(logs.stdout)
                sys.stderr.write(logs.stderr)
            except Exception:
                pass
            raise
        finally:
            cleanup()


if __name__ == "__main__":
    sys.exit(main())
