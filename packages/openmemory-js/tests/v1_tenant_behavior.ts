import { createApp } from "../src/api/index";
import { run_async } from "../src/database/connection";

process.env.OM_EMBEDDINGS = "synthetic";

type Route = {
  method: string;
  path: string;
  handler: (req: any, res: any, next?: any) => Promise<void> | void;
};

type ResponseCapture = {
  statusCode: number;
  body: any;
};

async function cleanup() {
  await run_async("DELETE FROM memories");
  try {
    await run_async("DELETE FROM vectors");
  } catch {}
  try {
    await run_async("DELETE FROM openmemory_vectors");
  } catch {}
  try {
    await run_async("DELETE FROM waypoints");
  } catch {}
}

async function invoke(
  route: Route,
  options: {
    body?: any;
    params?: Record<string, string>;
    query?: Record<string, string>;
  } = {},
): Promise<ResponseCapture> {
  const response: ResponseCapture = { statusCode: 200, body: undefined };
  const res = {
    status(code: number) {
      response.statusCode = code;
      return res;
    },
    json(body: any) {
      response.body = body;
      return res;
    },
  };

  await route.handler(
    {
      body: options.body || {},
      params: options.params || {},
      query: options.query || {},
    },
    res,
  );

  return response;
}

function findRoute(routes: Route[], method: string, path: string) {
  const route = routes.find((item) => item.method === method && item.path === path);
  if (!route) {
    throw new Error(`missing route ${method} ${path}`);
  }
  return route;
}

function assertNotFound(response: ResponseCapture, label: string) {
  if (response.statusCode !== 404 || response.body?.err !== "not_found") {
    throw new Error(`${label} must hide tenant mismatch as 404: ${JSON.stringify(response)}`);
  }
}

async function main() {
  await cleanup();
  const app = createApp();
  const routes = app.routes as Route[];

  const create = findRoute(routes, "POST", "/v1/memories");
  const addResponse = await invoke(create, {
    body: {
      content: "tenant mismatch memory",
      user_id: "tenant_owner",
      project_id: "tenant_project",
    },
  });
  if (addResponse.statusCode !== 200 || !addResponse.body?.id) {
    throw new Error(`failed to create memory for tenant test: ${JSON.stringify(addResponse)}`);
  }

  const id = addResponse.body.id;
  assertNotFound(
    await invoke(findRoute(routes, "GET", "/v1/memories/:id"), {
      params: { id },
      query: { user_id: "tenant_intruder" },
    }),
    "get",
  );
  assertNotFound(
    await invoke(findRoute(routes, "PATCH", "/v1/memories/:id"), {
      params: { id },
      body: { user_id: "tenant_intruder", content: "changed" },
    }),
    "update",
  );
  assertNotFound(
    await invoke(findRoute(routes, "POST", "/v1/memories/:id/reinforce"), {
      params: { id },
      body: { user_id: "tenant_intruder" },
    }),
    "reinforce",
  );
  assertNotFound(
    await invoke(findRoute(routes, "DELETE", "/v1/memories/:id"), {
      params: { id },
      body: { user_id: "tenant_intruder" },
    }),
    "delete",
  );

  console.log("[V1] tenant mismatch behavior verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

