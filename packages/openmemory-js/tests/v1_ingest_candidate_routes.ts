import { createApp } from "../src/api/index";

type Route = {
  method: string;
  path: string;
  handler: (req: any, res: any, next?: any) => Promise<void> | void;
};

async function invoke(
  route: Route,
  options: { body?: any; params?: Record<string, string> } = {},
) {
  const response = { statusCode: 200, body: undefined as any };
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
    { body: options.body || {}, params: options.params || {}, query: {} },
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

function assertInvalid(response: any, field: string) {
  if (
    response.statusCode !== 400 ||
    response.body?.err !== "invalid_request" ||
    response.body?.field !== field
  ) {
    throw new Error(`expected invalid ${field}: ${JSON.stringify(response)}`);
  }
}

async function main() {
  const app = createApp();
  const routes = app.routes as Route[];
  const accept = findRoute(routes, "POST", "/v1/ingest/candidates/:id/accept");
  const reject = findRoute(routes, "POST", "/v1/ingest/candidates/:id/reject");

  assertInvalid(await invoke(accept, { params: { id: "" } }), "id");
  assertInvalid(
    await invoke(reject, {
      params: { id: "candidate-id" },
      body: { reason: " " },
    }),
    "reason",
  );

  const localAccept = await invoke(accept, {
    params: { id: "candidate-id" },
    body: { source: { kind: "document", id: "fixture" } },
  });
  if (localAccept.statusCode !== 501 || localAccept.body?.err !== "unsupported") {
    throw new Error(`local candidate accept must stay disabled: ${JSON.stringify(localAccept)}`);
  }

  const localReject = await invoke(reject, {
    params: { id: "candidate-id" },
    body: { reason: "low confidence" },
  });
  if (localReject.statusCode !== 501 || localReject.body?.err !== "unsupported") {
    throw new Error(`local candidate reject must stay disabled: ${JSON.stringify(localReject)}`);
  }

  console.log("[V1] ingest candidate route contract verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

