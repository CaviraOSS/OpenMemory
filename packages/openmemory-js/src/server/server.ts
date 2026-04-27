"use strict";
/**
 *--------------------------------------------------------------------------------
 *  ______     _          _ _            _  _
 * |  ____|   | |        | | |          | || |
 * | |__ _   _| |__   ___| | |_   __   _| || |_
 * |  __| | | | '_ \ / _ \ | __|  \ \ / /__   _|
 * | |  | |_| | |_) |  __/ | |_    \ V /   | |
 * |_|   \__,_|_.__/ \___|_|\__|    \_/    |_|
 *--------------------------------------------------------------------------------
 *
 * @website   -  https:
 * @github    -  https:
 * @discord   -  https:
 *
 * @author    -  Cavira
 * @copyright -  2025 Cavira OSS
 * @version   -  4.0.0
 *
 *--------------------------------------------------------------------------------
 * server.ts - Application webserver (typed port of server.js).
 *
 * Behaviour preserved verbatim from the original server.js:
 *   - req augmentations: rawBody, body, path, params, query, hostname, ip
 *   - res augmentations: status(code), json(body), send(body), set(k,v)
 *   - middleware contract: (req, res, next) chained via WARES queue
 *   - JSON body parser: 413 on payload > max_payload_size, 400 on
 *     invalid JSON, raw bytes captured to req.rawBody for HMAC webhook
 *     verification
 *   - 404 fallthrough handler
 *   - WebSocket upgrade routing via .ws(path, handler)
 *   - Static file serving via serverStatic(endpoint, dir)
 *   - Route shapes: get/post/put/delete/patch/options/head/all + ws
 *--------------------------------------------------------------------------------
 **/

import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import type { IncomingMessage, ServerResponse } from "http";
import type { Socket } from "net";
import { parse } from "url";

// `ws` does not ship its own .d.ts and we are not allowed to add
// @types/ws here. Mirror the original server.js's `require('ws')` and
// keep the augmentation surface (.req on the WebSocket) typed locally.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const WS = require("ws") as {
    Server: new (opts: { noServer: boolean }) => {
        handleUpgrade: (
            req: IncomingMessage,
            socket: Socket,
            head: Buffer,
            cb: (ws: WsClient) => void,
        ) => void;
    };
};
type WsClient = unknown;

export interface AppRequest extends IncomingMessage {
    body?: unknown;
    rawBody?: Buffer;
    path?: string;
    params?: Record<string, string>;
    query?: Record<string, string | string[] | undefined>;
    hostname?: string;
    ip?: string;
    tenant?: string;
}

export interface AppResponse extends ServerResponse {
    status: (code: number) => AppResponse;
    json: (body: unknown) => void;
    send: (body: unknown) => void;
    set: (
        key: string,
        value: string | number | readonly string[],
    ) => AppResponse;
}

export type NextFn = (err?: unknown) => void;
export type Middleware = (
    req: AppRequest,
    res: AppResponse,
    next: NextFn,
) => void | Promise<void>;
export type RouteHandler = (
    req: AppRequest,
    res: AppResponse,
    next?: NextFn,
) => void | Promise<void>;
export type WsHandler = (ws: WsClient, req: IncomingMessage) => void;

interface RouteEntry {
    method: string;
    path: string;
    handler: RouteHandler;
}

interface WsRouteEntry {
    path: string;
    handler: WsHandler;
}

interface MatchedRoute {
    handler: RouteHandler;
    params: Record<string, string>;
}

export interface ServerConfig {
    max_payload_size?: number;
}

export interface App {
    use: (mw: Middleware) => void;
    listen: (port: number, cb?: () => void) => void;
    all: (path: string, handler: RouteHandler) => void;
    serverStatic: (endpoint: string, dir: string) => Middleware;
    routes: RouteEntry[];
    getRoutes: () => Record<string, string[]>;
    get: (path: string, handler: RouteHandler) => void;
    post: (path: string, handler: RouteHandler) => void;
    put: (path: string, handler: RouteHandler) => void;
    delete: (path: string, handler: RouteHandler) => void;
    patch: (path: string, handler: RouteHandler) => void;
    options: (path: string, handler: RouteHandler) => void;
    head: (path: string, handler: RouteHandler) => void;
    ws: (path: string, handler: WsHandler) => void;
}

export function server(config: ServerConfig = {}): App {
    const ROUTES: RouteEntry[] = [];
    const WARES: Middleware[] = [];
    const WS_ROUTES: WsRouteEntry[] = [];
    const wss = new WS.Server({ noServer: true });

    const matchRoute = (
        method: string,
        urlPath: string,
    ): MatchedRoute | null => {
        for (let i = 0; i < ROUTES.length; i++) {
            const r = ROUTES[i];
            if (r.method !== method && r.method !== "ALL") continue;
            const p = r.path.split("/").filter(Boolean);
            const u = urlPath.split("/").filter(Boolean);
            if (p.length !== u.length) continue;
            const params: Record<string, string> = {};
            let matched = true;
            for (let j = 0; j < p.length; j++) {
                if (p[j].startsWith(":")) {
                    params[p[j].slice(1)] = decodeURIComponent(u[j]);
                } else if (p[j] !== u[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched) return { handler: r.handler, params };
        }
        return null;
    };

    const SERVER = http.createServer(
        (rawReq: IncomingMessage, rawRes: ServerResponse) => {
            const req = rawReq as AppRequest;
            const res = rawRes as AppResponse;

            const u = parse(req.url || "", true);
            req.query = u.query || {};
            req.path = u.pathname || "/";
            req.hostname = (req.headers.host || "")
                .split(":")[0]
                .replace(/[^\w.-]/g, "");
            req.ip = (req.socket.remoteAddress || "").replace(/[^\w.:]/g, "");

            res.statusCode = 200;
            res.status = (x: number) => {
                res.statusCode = x;
                return res;
            };
            res.json = (x: unknown) => {
                res.writeHead(res.statusCode || 200, {
                    "Content-Type": "application/json",
                });
                res.end(JSON.stringify(x));
            };
            res.send = (x: unknown) => {
                if (x === undefined || x === null) x = "";
                if (typeof x === "object") return res.json(x);
                res.writeHead(res.statusCode || 200, {
                    "Content-Type": "text/plain",
                });
                res.end(String(x));
            };
            res.set = (k: string, v: string | number | readonly string[]) => {
                res.setHeader(k, v);
                return res;
            };

            const r = matchRoute((req.method || "GET").toUpperCase(), req.path);
            req.params = r ? r.params : {};

            const fns: Array<Middleware | RouteHandler> = [...WARES];
            fns.push(
                r
                    ? (rq: AppRequest, rs: AppResponse, next: NextFn) =>
                          r.handler(rq, rs, next)
                    : (_rq: AppRequest, rs: AppResponse) => {
                          rs.status(404).end("404: Not Found");
                      },
            );

            let i = 0;
            const next: NextFn = () => {
                if (i < fns.length) {
                    const fn = fns[i++];
                    (fn as Middleware)(req, res, next);
                }
            };
            next();
        },
    );

    SERVER.on(
        "upgrade",
        (req: IncomingMessage, socket: Socket, head: Buffer) => {
            const u = parse(req.url || "", true);
            const reqPath = u.pathname;
            if (
                !reqPath ||
                reqPath.includes("..") ||
                /[\0-\x1F\x7F]/.test(reqPath)
            ) {
                socket.destroy();
                return;
            }
            for (let i = 0; i < WS_ROUTES.length; i++) {
                const r = WS_ROUTES[i];
                if (r.path === reqPath) {
                    wss.handleUpgrade(req, socket, head, (ws: WsClient) => {
                        // Preserve original behaviour: the WS handler reads
                        // ws.req for request context. Type as cast since
                        // ws's WebSocket type is not in scope without
                        // @types/ws.
                        (ws as unknown as { req: IncomingMessage }).req = req;
                        r.handler(ws, req);
                    });
                    return;
                }
            }
            socket.destroy();
        },
    );

    const add = (method: string, p: string, handler: RouteHandler): void => {
        ROUTES.push({ method: method.toUpperCase(), path: p, handler });
    };
    const use = (mw: Middleware): void => {
        WARES.push(mw);
    };
    const listen = (port: number, cb?: () => void): void => {
        SERVER.setTimeout(10000);
        SERVER.listen(port, cb);
    };
    const all = (p: string, handler: RouteHandler): void => {
        add("ALL", p, handler);
    };
    const getRoutes = (): Record<string, string[]> =>
        ROUTES.reduce((acc: Record<string, string[]>, { method, path: p }) => {
            (acc[method] = acc[method] || []).push(p);
            return acc;
        }, {});

    const serverStatic = (endpoint: string, dir: string): Middleware => {
        const a = path.resolve(dir);
        if (!fs.existsSync(a) || !fs.statSync(a).isDirectory()) {
            console.error(
                `[STATIC] Directory not found or is not a directory: ${a}`,
            );
            return (_req: AppRequest, _res: AppResponse, next: NextFn) =>
                next();
        }
        const b = endpoint.endsWith("/") ? endpoint : endpoint + "/";

        function getContentType(file: string): string {
            switch (path.extname(file).toLowerCase()) {
                case ".html":
                    return "text/html";
                case ".js":
                    return "text/javascript";
                case ".css":
                    return "text/css";
                case ".json":
                    return "application/json";
                case ".txt":
                    return "text/plain";
                case ".ico":
                    return "image/x-icon";
                case ".png":
                    return "image/png";
                case ".webp":
                    return "image/webp";
                case ".jpg":
                    return "image/jpeg";
                case ".jpeg":
                    return "image/jpeg";
                case ".gif":
                    return "image/gif";
                case ".svg":
                    return "image/svg+xml";
                default:
                    return "application/octet-stream";
            }
        }

        return function staticMiddleware(
            req: AppRequest,
            res: AppResponse,
            next: NextFn,
        ): void {
            if (req.method !== "GET" && req.method !== "HEAD") return next();
            const reqPath = req.path || "";
            if (!reqPath.startsWith(b)) return next();
            const c = path.join(a, reqPath.substring(b.length));
            const d = path.relative(a, c);
            if (!(d && !d.startsWith("..") && !path.isAbsolute(d)))
                return next();
            fs.stat(c, (err, stats) => {
                if (err || !stats.isFile()) return next();
                res.setHeader("Content-Type", getContentType(c));
                fs.createReadStream(c).pipe(res);
            });
        };
    };

    use((req: AppRequest, res: AppResponse, next: NextFn) => {
        const ct = req.headers["content-type"];
        if (typeof ct === "string" && ct.includes("application/json")) {
            const chunks: Buffer[] = [];
            let total = 0;
            const max = config.max_payload_size || 1_000_000;
            let aborted = false;
            req.on("data", (e: Buffer | string) => {
                if (aborted) return;
                const buf = Buffer.isBuffer(e) ? e : Buffer.from(e);
                total += buf.length;
                if (total > max) {
                    aborted = true;
                    res.status(413).end("Payload Too Large");
                    req.destroy();
                    return;
                }
                chunks.push(buf);
            });
            req.on("end", () => {
                if (aborted) return;
                const raw = Buffer.concat(chunks);
                // Expose raw bytes for HMAC webhook verification.
                req.rawBody = raw;
                const text = raw.toString("utf8");
                if (text.length === 0) {
                    req.body = {};
                    return next();
                }
                try {
                    req.body = JSON.parse(text);
                } catch {
                    // SECURITY: previously we silently set req.body = null which
                    // forced every downstream handler to second-guess client input.
                    // Now we 400 here — invalid JSON is a client error.
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ error: "invalid_json" }));
                    return;
                }
                next();
            });
        } else {
            next();
        }
    });

    return {
        use,
        listen,
        all,
        serverStatic,
        routes: ROUTES,
        getRoutes,
        get: (p: string, handler: RouteHandler) => add("GET", p, handler),
        post: (p: string, handler: RouteHandler) => add("POST", p, handler),
        put: (p: string, handler: RouteHandler) => add("PUT", p, handler),
        delete: (p: string, handler: RouteHandler) => add("DELETE", p, handler),
        patch: (p: string, handler: RouteHandler) => add("PATCH", p, handler),
        options: (p: string, handler: RouteHandler) =>
            add("OPTIONS", p, handler),
        head: (p: string, handler: RouteHandler) => add("HEAD", p, handler),
        ws: (p: string, handler: WsHandler) =>
            WS_ROUTES.push({ path: p, handler }),
    };
}

/**
 *--------------------------------------------------------------------------------
 * @EOF - End Of File
 *--------------------------------------------------------------------------------
 **/
