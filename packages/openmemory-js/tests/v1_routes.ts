import { createApp } from "../src/api/index";

const routes = createApp().getRoutes();

const expected: Array<[string, string]> = [
  ["POST", "/v1/memories"],
  ["POST", "/v1/recall"],
  ["GET", "/v1/memories/:id/explain"],
];

for (const [method, path] of expected) {
  if (!routes[method]?.includes(path)) {
    throw new Error(`missing route ${method} ${path}`);
  }
}

console.log("[V1] route contract verified");
process.exit(0);
