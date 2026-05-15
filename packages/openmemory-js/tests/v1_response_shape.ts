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

function assertOk(response: ResponseCapture, label: string) {
  if (response.statusCode !== 200) {
    throw new Error(`${label} failed: ${JSON.stringify(response)}`);
  }
}

async function main() {
  await cleanup();
  const app = createApp();
  const routes = app.routes as Route[];

  const create = await invoke(findRoute(routes, "POST", "/v1/memories"), {
    body: {
      content: "response shape memory",
      user_id: "shape_user",
      project_id: "shape_project",
      tags: ["shape"],
    },
  });
  assertOk(create, "create");
  if (!create.body.id || create.body.memory?.id !== create.body.id) {
    throw new Error(`create must include top-level id and memory envelope: ${JSON.stringify(create.body)}`);
  }

  const id = create.body.id;
  const get = await invoke(findRoute(routes, "GET", "/v1/memories/:id"), {
    params: { id },
    query: { user_id: "shape_user" },
  });
  assertOk(get, "get");
  if (get.body.id !== id || get.body.memory?.id !== id) {
    throw new Error(`get must include top-level id and memory envelope: ${JSON.stringify(get.body)}`);
  }

  const explain = await invoke(findRoute(routes, "GET", "/v1/memories/:id/explain"), {
    params: { id },
  });
  assertOk(explain, "explain");
  if (
    explain.body.id !== id ||
    typeof explain.body.content !== "string" ||
    !explain.body.bitemporal ||
    !explain.body.score_components ||
    !Array.isArray(explain.body.provenance) ||
    !Array.isArray(explain.body.contradictions) ||
    !Array.isArray(explain.body.inference_path) ||
    !Array.isArray(explain.body.versions) ||
    !Array.isArray(explain.body.audit_events) ||
    !Array.isArray(explain.body.reasons) ||
    typeof explain.body.contracts !== "object" ||
    typeof explain.body.metadata !== "object"
  ) {
    throw new Error(`explain must expose normalized schema fields: ${JSON.stringify(explain.body)}`);
  }

  const list = await invoke(findRoute(routes, "GET", "/v1/memories"), {
    query: { user_id: "shape_user", limit: "10", offset: "0" },
  });
  assertOk(list, "list");
  if (
    !Array.isArray(list.body.items) ||
    !list.body.items.some((item: any) => item.id === id) ||
    list.body.page?.limit !== 10 ||
    list.body.page?.offset !== 0 ||
    typeof list.body.page?.count !== "number"
  ) {
    throw new Error(`list must include items and page metadata: ${JSON.stringify(list.body)}`);
  }

  const update = await invoke(findRoute(routes, "PATCH", "/v1/memories/:id"), {
    params: { id },
    body: {
      user_id: "shape_user",
      content: "updated response shape memory",
    },
  });
  assertOk(update, "update");
  if (update.body.id !== id || update.body.memory?.id !== id) {
    throw new Error(`update must include top-level id and memory envelope: ${JSON.stringify(update.body)}`);
  }

  const reinforce = await invoke(findRoute(routes, "POST", "/v1/memories/:id/reinforce"), {
    params: { id },
    body: { user_id: "shape_user", boost: 0.1 },
  });
  assertOk(reinforce, "reinforce");
  if (reinforce.body.ok !== true || reinforce.body.memory?.id !== id) {
    throw new Error(`reinforce must include ok and memory envelope: ${JSON.stringify(reinforce.body)}`);
  }

  const del = await invoke(findRoute(routes, "DELETE", "/v1/memories/:id"), {
    params: { id },
    body: { user_id: "shape_user" },
  });
  assertOk(del, "delete");
  if (del.body.ok !== true || del.body.deleted?.id !== id) {
    throw new Error(`delete must include ok and deleted envelope: ${JSON.stringify(del.body)}`);
  }

  console.log("[V1] response shape contract verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
