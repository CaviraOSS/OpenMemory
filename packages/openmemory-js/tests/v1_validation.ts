import { createApp } from "../src/api/index";

type Route = {
  method: string;
  path: string;
  handler: (req: any, res: any, next?: any) => Promise<void> | void;
};

type ResponseCapture = {
  statusCode: number;
  body: any;
};

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

function assertInvalid(response: ResponseCapture, field: string) {
  if (
    response.statusCode !== 400 ||
    response.body?.err !== "invalid_request" ||
    response.body?.field !== field
  ) {
    throw new Error(`expected invalid ${field}, got ${JSON.stringify(response)}`);
  }
}

async function main() {
  const app = createApp();
  const routes = app.routes as Route[];

  assertInvalid(
    await invoke(findRoute(routes, "POST", "/v1/memories"), {
      body: { content: "   " },
    }),
    "content",
  );

  assertInvalid(
    await invoke(findRoute(routes, "POST", "/v1/recall"), {
      body: { query: "memory", mode: "magic" },
    }),
    "mode",
  );

  assertInvalid(
    await invoke(findRoute(routes, "POST", "/v1/recall"), {
      body: { query: "memory", at_time: "not-a-date" },
    }),
    "at_time",
  );

  assertInvalid(
    await invoke(findRoute(routes, "GET", "/v1/memories"), {
      query: { limit: "0" },
    }),
    "limit",
  );

  assertInvalid(
    await invoke(findRoute(routes, "PATCH", "/v1/memories/:id"), {
      params: { id: "memory-id" },
      body: { user_id: "user-only" },
    }),
    "body",
  );

  assertInvalid(
    await invoke(findRoute(routes, "POST", "/v1/memories/:id/reinforce"), {
      params: { id: "memory-id" },
      body: { boost: 2 },
    }),
    "boost",
  );

  assertInvalid(
    await invoke(findRoute(routes, "POST", "/v1/consolidations"), {
      body: { source_memory_ids: "not-an-array" },
    }),
    "source_memory_ids",
  );

  console.log("[V1] validation contract verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

