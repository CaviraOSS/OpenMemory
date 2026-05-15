import { createApp } from "../src/api/index";

const routes = createApp().getRoutes();

const expected: Array<[string, string]> = [
  ["POST", "/v1/memories"],
  ["GET", "/v1/memories"],
  ["GET", "/v1/memories/:id"],
  ["POST", "/v1/recall"],
  ["GET", "/v1/memories/:id/explain"],
  ["PATCH", "/v1/memories/:id"],
  ["POST", "/v1/memories/:id/reinforce"],
  ["DELETE", "/v1/memories/:id"],
  ["POST", "/v1/contradictions/:id/resolve"],
  ["POST", "/v1/consolidations"],
  ["POST", "/v1/ingest"],
  ["POST", "/v1/ingest/candidates/:id/accept"],
  ["POST", "/v1/ingest/candidates/:id/reject"],
];

for (const [method, path] of expected) {
  if (!routes[method]?.includes(path)) {
    throw new Error(`missing route ${method} ${path}`);
  }
}

console.log("[V1] route contract verified");
process.exit(0);
