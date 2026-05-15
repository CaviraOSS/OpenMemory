import { createApp } from "../src/api/index";

type Route = {
  method: string;
  path: string;
  handler: (req: any, res: any, next?: any) => Promise<void> | void;
};

async function invoke(route: Route, body: any) {
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
  await route.handler({ body, params: {}, query: {} }, res);
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
  const app = createApp();
  const route = findRoute(app.routes as Route[], "POST", "/v1/ingest");

  const invalidSource = await invoke(route, {
    content: "missing source kind",
    source: {},
  });
  if (
    invalidSource.statusCode !== 400 ||
    invalidSource.body?.err !== "invalid_request" ||
    invalidSource.body?.field !== "source.kind"
  ) {
    throw new Error(`ingest must validate source kind: ${JSON.stringify(invalidSource)}`);
  }

  const invalidContent = await invoke(route, {
    content: "",
    source: { kind: "text" },
  });
  if (
    invalidContent.statusCode !== 400 ||
    invalidContent.body?.err !== "invalid_request" ||
    invalidContent.body?.field !== "content"
  ) {
    throw new Error(`ingest must validate content: ${JSON.stringify(invalidContent)}`);
  }

  const unsupported = await invoke(route, {
    user_id: "ingest_user",
    project_id: "ingest_project",
    source: { kind: "text", content_type: "text/plain" },
    content: "raw durable ingest event",
  });
  if (unsupported.statusCode !== 501 || unsupported.body?.err !== "unsupported") {
    throw new Error(`local durable ingest must stay disabled: ${JSON.stringify(unsupported)}`);
  }

  console.log("[V1] ingest route contract verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
