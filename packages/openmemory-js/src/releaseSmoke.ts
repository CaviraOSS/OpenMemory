import type http from "node:http";
import { setTimeout as delay } from "node:timers/promises";

const port = Number(process.env.OM_RELEASE_SMOKE_PORT || 18080);
process.env.OM_PORT ||= String(port);
process.env.OM_EMBEDDINGS ||= "synthetic";
process.env.OM_REQUIRE_API_KEY ||= "false";

type Json = Record<string, any>;

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? (JSON.parse(text) as Json) : {};
  if (!response.ok) {
    throw new Error(
      `${init.method || "GET"} ${path} failed: ${response.status} ${text}`,
    );
  }
  return body;
}

async function waitForHealth() {
  let lastError: unknown;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const body = await request("/health");
      if (body.ok === true) return body;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError || new Error("health check did not become ready");
}

async function runFullSmoke() {
  const memory = await request("/v1/memories", {
    method: "POST",
    body: JSON.stringify({
      content: "release smoke memory for strict recall",
      user_id: "release-smoke-user",
      project_id: "release-smoke-project",
      source: {
        kind: "release-smoke",
        id: "release-smoke-source",
      },
      contracts: {
        recall_allowed: true,
      },
    }),
  });

  const memoryId = memory.memory_id || memory.id;
  if (!memoryId)
    throw new Error("remember response did not include a memory id");

  const recall = await request("/v1/recall", {
    method: "POST",
    body: JSON.stringify({
      query: "release smoke memory",
      mode: "strict",
      user_id: "release-smoke-user",
      project_id: "release-smoke-project",
      limit: 5,
    }),
  });
  if (!Array.isArray(recall.results) || recall.results.length === 0) {
    throw new Error("strict recall did not return the smoke memory");
  }

  const explain = await request(
    `/v1/memories/${encodeURIComponent(memoryId)}/explain`,
  );
  if (explain.id !== memoryId && explain.memory_id !== memoryId) {
    throw new Error("explain response did not match the smoke memory");
  }
}

async function closeServer(server: http.Server) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function main() {
  const { createApp } = await import("./api/index");
  const app = createApp();
  const server = app.listen(port);

  try {
    await waitForHealth();
    if (process.env.OM_RELEASE_SMOKE_FULL === "true") {
      await runFullSmoke();
    }
    console.log(
      process.env.OM_RELEASE_SMOKE_FULL === "true"
        ? "release smoke passed: health, remember, strict recall, explain"
        : "release smoke passed: health",
    );
  } finally {
    await closeServer(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
