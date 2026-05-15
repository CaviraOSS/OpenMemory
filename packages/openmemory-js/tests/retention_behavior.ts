import { createApp } from "../src/api/index";
import { q, run_async, vector_store } from "../src/database/connection";

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
    end(body?: any) {
      response.body = body;
      return res;
    },
    setHeader() {
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

async function main() {
  await cleanup();
  const app = createApp();
  const routes = app.routes as Route[];

  const add = findRoute(routes, "POST", "/retention/add");
  const query = findRoute(routes, "POST", "/retention/query");
  const reinforce = findRoute(routes, "POST", "/retention/reinforce");
  const update = findRoute(routes, "PATCH", "/retention/:id");
  const list = findRoute(routes, "GET", "/retention/all");
  const get = findRoute(routes, "GET", "/retention/:id");
  const del = findRoute(routes, "DELETE", "/retention/:id");

  const addResponse = await invoke(add, {
    body: {
      content: "Legacy retention parity memory: cyan notebook",
      tags: ["legacy", "parity"],
      metadata: { source: "retention_behavior" },
      user_id: "legacy_user",
      project_id: "legacy_project",
    },
  });

  if (addResponse.statusCode !== 200 || !addResponse.body?.id) {
    throw new Error(`retention add failed: ${JSON.stringify(addResponse)}`);
  }

  const memoryId = addResponse.body.id;
  const row = await q.get_mem.get(memoryId);
  if (!row || row.user_id !== "legacy_user") {
    throw new Error("retention add did not persist the expected user memory");
  }

  const getResponse = await invoke(get, {
    params: { id: memoryId },
    query: { user_id: "legacy_user" },
  });
  if (
    getResponse.statusCode !== 200 ||
    getResponse.body.id !== memoryId ||
    !getResponse.body.sectors?.includes("semantic")
  ) {
    throw new Error(`retention get returned wrong shape: ${JSON.stringify(getResponse.body)}`);
  }

  const listResponse = await invoke(list, {
    query: { user_id: "legacy_user", l: "10", u: "0" },
  });
  if (
    listResponse.statusCode !== 200 ||
    !listResponse.body.items?.some((item: any) => item.id === memoryId)
  ) {
    throw new Error(`retention all did not list created memory: ${JSON.stringify(listResponse.body)}`);
  }

  const queryResponse = await invoke(query, {
    body: {
      query: "cyan notebook",
      user_id: "legacy_user",
      project_id: "legacy_project",
      k: 5,
    },
  });
  if (
    queryResponse.statusCode !== 200 ||
    !queryResponse.body.matches?.some((item: any) => item.id === memoryId)
  ) {
    throw new Error(`retention query did not return created memory: ${JSON.stringify(queryResponse.body)}`);
  }

  const reinforceResponse = await invoke(reinforce, {
    body: { id: memoryId, boost: 0.2 },
  });
  if (reinforceResponse.statusCode !== 200 || reinforceResponse.body.ok !== true) {
    throw new Error(`retention reinforce failed: ${JSON.stringify(reinforceResponse)}`);
  }

  const updateResponse = await invoke(update, {
    params: { id: memoryId },
    body: {
      content: "Legacy retention parity memory: green notebook",
      tags: ["legacy", "updated"],
      metadata: { source: "retention_behavior", updated: true },
      user_id: "legacy_user",
    },
  });
  if (
    updateResponse.statusCode !== 200 ||
    updateResponse.body.id !== memoryId ||
    updateResponse.body.updated !== true
  ) {
    throw new Error(`retention update failed: ${JSON.stringify(updateResponse.body)}`);
  }

  const updatedRow = await q.get_mem.get(memoryId);
  if (updatedRow?.content !== "Legacy retention parity memory: green notebook") {
    throw new Error("retention update did not persist content change");
  }

  const forbiddenResponse = await invoke(get, {
    params: { id: memoryId },
    query: { user_id: "other_user" },
  });
  if (forbiddenResponse.statusCode !== 403 || forbiddenResponse.body.err !== "forbidden") {
    throw new Error(`retention get must preserve legacy 403 on user mismatch`);
  }

  const deleteResponse = await invoke(del, {
    params: { id: memoryId },
    query: { user_id: "legacy_user" },
  });
  if (deleteResponse.statusCode !== 200 || deleteResponse.body.ok !== true) {
    throw new Error(`retention delete failed: ${JSON.stringify(deleteResponse.body)}`);
  }

  const deletedRow = await q.get_mem.get(memoryId);
  const deletedVectors = await vector_store.getVectorsById(memoryId);
  if (deletedRow || deletedVectors.length !== 0) {
    throw new Error("retention delete must preserve legacy hard-delete semantics");
  }

  console.log("[RETENTION] legacy behavior contract verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
