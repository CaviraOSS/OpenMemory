import { createApp } from "../src/api/index";
import { q, run_async } from "../src/database/connection";

process.env.OM_EMBEDDINGS = "synthetic";

type Route = {
  method: string;
  path: string;
  handler: (req: any, res: any, next?: any) => Promise<void> | void;
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
  await cleanup();
  const app = createApp();
  const routes = app.routes as Route[];
  const ingest = findRoute(routes, "POST", "/retention/ingest");
  const ingestUrl = findRoute(routes, "POST", "/retention/ingest/url");

  const missingDocument = await invoke(ingest, {});
  if (missingDocument.statusCode !== 400 || missingDocument.body?.err !== "missing") {
    throw new Error(`document ingest must keep missing error: ${JSON.stringify(missingDocument)}`);
  }

  const document = await invoke(ingest, {
    content_type: "text",
    data: "Legacy document ingest fixture",
    metadata: { source: "retention_ingest_behavior" },
    user_id: "ingest_user",
  });
  if (
    document.statusCode !== 200 ||
    document.body?.strategy !== "single" ||
    !document.body?.root_memory_id
  ) {
    throw new Error(`document ingest failed: ${JSON.stringify(document)}`);
  }
  const documentRow = await q.get_mem.get(document.body.root_memory_id);
  if (!documentRow || documentRow.user_id !== "ingest_user") {
    throw new Error("document ingest did not persist root memory");
  }

  const missingUrl = await invoke(ingestUrl, {});
  if (missingUrl.statusCode !== 400 || missingUrl.body?.err !== "no_url") {
    throw new Error(`url ingest must keep no_url error: ${JSON.stringify(missingUrl)}`);
  }

  const url = await invoke(ingestUrl, {
    url: "data:text/html,%3Ch1%3ELegacy%20URL%20fixture%3C%2Fh1%3E",
    metadata: { source: "retention_ingest_behavior" },
    user_id: "ingest_url_user",
  });
  if (url.statusCode !== 200 || url.body?.strategy !== "single" || !url.body?.root_memory_id) {
    throw new Error(`url ingest failed: ${JSON.stringify(url)}`);
  }
  const urlRow = await q.get_mem.get(url.body.root_memory_id);
  if (!urlRow || urlRow.user_id !== "ingest_url_user") {
    throw new Error("url ingest did not persist root memory");
  }

  console.log("[RETENTION] legacy ingest behavior verified");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

