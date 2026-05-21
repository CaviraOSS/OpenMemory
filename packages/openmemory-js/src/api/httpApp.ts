import http from "node:http";
import { parse } from "node:url";

type Request = http.IncomingMessage & {
  body?: any;
  hostname?: string;
  ip?: string;
  params: Record<string, string>;
  path: string;
  query: Record<string, any>;
  rawBody?: Buffer;
};

type Response = http.ServerResponse & {
  json: (body: unknown) => void;
  send: (body?: unknown) => void;
  set: (key: string, value: string) => Response;
  status: (code: number) => Response;
};

type Middleware = (req: Request, res: Response, next: () => void) => void;
type Handler = (req: Request, res: Response, next?: () => void) => void;
type Route = {
  method: string;
  path: string;
  handler: Handler;
};

export type HttpApp = {
  use: (handler: Middleware) => void;
  listen: (port: number, callback?: () => void) => http.Server;
  get: (path: string, handler: Handler) => void;
  post: (path: string, handler: Handler) => void;
  put: (path: string, handler: Handler) => void;
  patch: (path: string, handler: Handler) => void;
  delete: (path: string, handler: Handler) => void;
  options: (path: string, handler: Handler) => void;
  all: (path: string, handler: Handler) => void;
  routes: Route[];
  getRoutes: () => Record<string, string[]>;
};

const matchRoute = (routes: Route[], method: string, path: string) => {
  for (const route of routes) {
    if (route.method !== method && route.method !== "ALL") continue;

    const routeParts = route.path.split("/").filter(Boolean);
    const pathParts = path.split("/").filter(Boolean);
    if (routeParts.length !== pathParts.length) continue;

    const params: Record<string, string> = {};
    let matched = true;
    for (let i = 0; i < routeParts.length; i++) {
      const routePart = routeParts[i];
      const pathPart = pathParts[i];
      if (routePart.startsWith(":")) {
        params[routePart.slice(1)] = decodeURIComponent(pathPart);
      } else if (routePart !== pathPart) {
        matched = false;
        break;
      }
    }

    if (matched) return { route, params };
  }
  return null;
};

const attachResponseHelpers = (res: http.ServerResponse): Response => {
  const response = res as Response;
  response.status = (code: number) => {
    response.statusCode = code;
    return response;
  };
  response.set = (key: string, value: string) => {
    response.setHeader(key, value);
    return response;
  };
  response.json = (body: unknown) => {
    response.writeHead(response.statusCode || 200, {
      "content-type": "application/json",
    });
    response.end(JSON.stringify(body));
  };
  response.send = (body?: unknown) => {
    if (body && typeof body === "object") return response.json(body);
    response.writeHead(response.statusCode || 200, {
      "content-type": "text/plain",
    });
    response.end(body === undefined || body === null ? "" : String(body));
  };
  return response;
};

const parseJsonBody = (
  req: Request,
  res: Response,
  maxPayloadSize: number,
  next: () => void,
) => {
  if (!req.headers["content-type"]?.includes("application/json")) {
    next();
    return;
  }

  const chunks: Buffer[] = [];
  let rawLength = 0;
  req.on("data", (chunk) => {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    chunks.push(buffer);
    rawLength += buffer.length;
    if (rawLength > maxPayloadSize) {
      res.status(413).send("Payload Too Large");
      req.destroy();
    }
  });
  req.on("end", () => {
    req.rawBody = Buffer.concat(chunks);
    const raw = req.rawBody.toString("utf8");
    if (raw.length === 0) {
      req.body = {};
      next();
      return;
    }

    try {
      req.body = JSON.parse(raw);
    } catch {
      req.body = {};
    }
    next();
  });
};

export function createHttpApp(config: { max_payload_size?: number } = {}) {
  const routes: Route[] = [];
  const middleware: Middleware[] = [];
  const maxPayloadSize = config.max_payload_size || 1_000_000;

  const add = (method: string, path: string, handler: Handler) => {
    routes.push({ method, path, handler });
  };

  const server = http.createServer((incoming, outgoing) => {
    const req = incoming as Request;
    const res = attachResponseHelpers(outgoing);
    const parsed = parse(req.url || "", true);
    req.query = parsed.query || {};
    req.path = parsed.pathname || "/";
    req.params = {};
    req.hostname = (req.headers.host || "")
      .split(":")[0]
      .replace(/[^\w.-]/g, "");
    req.ip = (req.socket.remoteAddress || "").replace(/[^\w.:]/g, "");

    const matched = matchRoute(
      routes,
      req.method?.toUpperCase() || "GET",
      req.path,
    );
    req.params = matched?.params || {};

    const stack = [
      (next: () => void) => parseJsonBody(req, res, maxPayloadSize, next),
      ...middleware.map(
        (handler) => (next: () => void) => handler(req, res, next),
      ),
      (next: () => void) =>
        matched
          ? matched.route.handler(req, res, next)
          : res.status(404).send("404: Not Found"),
    ];

    let index = 0;
    const next = () => {
      const fn = stack[index++];
      if (fn) fn(next);
    };
    next();
  });

  const app: HttpApp = {
    use: (handler) => middleware.push(handler),
    listen: (port, callback) => {
      server.setTimeout(10_000);
      return server.listen(port, callback);
    },
    get: (path, handler) => add("GET", path, handler),
    post: (path, handler) => add("POST", path, handler),
    put: (path, handler) => add("PUT", path, handler),
    patch: (path, handler) => add("PATCH", path, handler),
    delete: (path, handler) => add("DELETE", path, handler),
    options: (path, handler) => add("OPTIONS", path, handler),
    all: (path, handler) => add("ALL", path, handler),
    routes,
    getRoutes: () =>
      routes.reduce<Record<string, string[]>>((acc, route) => {
        acc[route.method] = acc[route.method] || [];
        acc[route.method].push(route.path);
        return acc;
      }, {}),
  };

  return app;
}
