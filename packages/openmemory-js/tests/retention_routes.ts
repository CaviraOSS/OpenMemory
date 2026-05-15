import { createApp } from "../src/api/index";

const routes = createApp().getRoutes();

const expected: Array<[string, string]> = [
  ["POST", "/retention/add"],
  ["POST", "/retention/ingest"],
  ["POST", "/retention/ingest/url"],
  ["POST", "/retention/query"],
  ["POST", "/retention/reinforce"],
  ["PATCH", "/retention/:id"],
  ["GET", "/retention/all"],
  ["GET", "/retention/:id"],
  ["DELETE", "/retention/:id"],
];

for (const [method, path] of expected) {
  if (!routes[method]?.includes(path)) {
    throw new Error(`missing legacy route ${method} ${path}`);
  }
}

console.log("[RETENTION] legacy route contract verified");
process.exit(0);

