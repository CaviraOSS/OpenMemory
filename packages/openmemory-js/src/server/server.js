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
 * server.js - Application webserver.
 *--------------------------------------------------------------------------------
**/
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
const { parse } = require('url');
function server(config = {}) {
    const ROUTES = [];
    const WARES = [];
    const WS_ROUTES = [];
    const wss = new WebSocket.Server({ noServer: true });
    const SERVER = http.createServer((req, res) => {
        let u = parse(req.url, true);
        req.query = u.query || {};
        req.path = u.pathname;
        req.hostname = (req.headers.host || '').split(':')[0].replace(/[^\w.-]/g, '');
        req.ip = (req.socket.remoteAddress || '').replace(/[^\w.:]/g, '');
        res.statusCode = 200;
        res.status = (x) => {
            res.statusCode = x;
            return res;
        };
        res.json = (x) => {
            res.writeHead(res.statusCode || 200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(x));
        };
        res.send = (x) => {
            if (x === undefined || x === null)
                x = '';
            if (typeof x === 'object')
                return res.json(x);
            res.writeHead(res.statusCode || 200, { 'Content-Type': 'text/plain' });
            res.end(String(x));
        };
        res.set = (k, v) => { res.setHeader(k, v); return res; };
        let r = matchRoute(req.method.toUpperCase(), req.path);
        req.params = r ? r.params : {};
        let fns = [...WARES];
        fns.push(r ? (req, res, next) => r.handler(req, res, next) : (_req, res) => res.status(404).end('404: Not Found'));
        let i = 0;
        let next = () => {
            if (i < fns.length)
                fns[i++](req, res, next);
        };
        next();
    });
    SERVER.on('upgrade', (req, socket, head) => {
        let u = parse(req.url || '', true);
        let path = u.pathname;
        if (!path || path.includes('..') || /[\0-\x1F\x7F]/.test(path)) {
            socket.destroy();
            return;
        }
        for (let i = 0; i < WS_ROUTES.length; i++) {
            let r = WS_ROUTES[i];
            if (r.path === path) {
                wss.handleUpgrade(req, socket, head, (ws) => {
                    ws.req = req;
                    r.handler(ws, req);
                });
                return;
            }
        }
        socket.destroy();
    });
    const matchRoute = (a, b) => {
        for (let i = 0; i < ROUTES.length; i++) {
            let r = ROUTES[i];
            if (r.method !== a && r.method !== 'ALL')
                continue;
            let p = r.path.split('/').filter(Boolean);
            let u = b.split('/').filter(Boolean);
            if (p.length !== u.length)
                continue;
            let params = {};
            let matched = true;
            for (let j = 0; j < p.length; j++) {
                if (p[j].startsWith(':')) {
                    params[p[j].slice(1)] = decodeURIComponent(u[j]);
                }
                else if (p[j] !== u[j]) {
                    matched = false;
                    break;
                }
            }
            if (matched)
                return { handler: r.handler, params };
        }
        return null;
    };
    const add = (a, b, c) => { ROUTES.push({ method: a.toUpperCase(), path: b, handler: c }); };
    const use = (a) => { WARES.push(a); };
    const listen = (a, b) => { SERVER.setTimeout(10000); SERVER.listen(a, b); };
    const all = (a, b) => { add('ALL', a, b); };
    const getRoutes = () => ROUTES.reduce((acc, { method, path }) => ((acc[method] = acc[method] || []).push(path), acc), {});
    const serverStatic = (endpoint, dir) => {
        const a = path.resolve(dir);
        if (!fs.existsSync(a) || !fs.statSync(a).isDirectory()) {
            console.error(`[STATIC] Directory not found or is not a directory: ${a}`);
            return (req, res, next) => next();
        }
        let b = (endpoint.endsWith('/') ? endpoint : endpoint + '/');
        return function staticMiddleware(req, res, next) {
            if (req.method !== 'GET' && req.method !== 'HEAD')
                return next();
            if (!req.path.startsWith(b))
                return next();
            let c = path.join(a, req.path.substring(b.length));
            let d = path.relative(a, c);
            if (!(d && !d.startsWith('..') && !path.isAbsolute(d)))
                return next();
            fs.stat(c, (err, stats) => {
                if (err || !stats.isFile())
                    return next();
                res.setHeader('Content-Type', getContentType(c));
                fs.createReadStream(c).pipe(res);
            });
        };
        function getContentType(a) {
            switch (path.extname(a).toLowerCase()) {
                case '.html': return 'text/html';
                case '.js': return 'text/javascript';
                case '.css': return 'text/css';
                case '.json': return 'application/json';
                case '.txt': return 'text/plain';
                case '.ico': return 'image/x-icon';
                case '.png': return 'image/png';
                case '.webp': return 'image/webp';
                case '.jpg': return 'image/jpeg';
                case '.jpeg': return 'image/jpeg';
                case '.gif': return 'image/gif';
                case '.svg': return 'image/svg+xml';
                default: return 'application/octet-stream';
            }
        }
    };
    use((req, res, next) => {
        if (req.headers['content-type']?.includes('application/json')) {
            let d = '';
            let max = config.max_payload_size || 1_000_000;
            req.on('data', e => {
                d += e;
                if (d.length > max) {
                    res.status(413).end('Payload Too Large');
                    req.destroy();
                }
            });
            req.on('end', () => {
                try {
                    req.body = JSON.parse(d);
                }
                catch {
                    req.body = null;
                }
                next();
            });
        }
        else {
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
        get: (a, b) => add('GET', a, b),
        post: (a, b) => add('POST', a, b),
        put: (a, b) => add('PUT', a, b),
        delete: (a, b) => add('DELETE', a, b),
        patch: (a, b) => add('PATCH', a, b),
        options: (a, b) => add('OPTIONS', a, b),
        head: (a, b) => add('HEAD', a, b),
        all: (a, b) => add('ALL', a, b),
        ws: (a, b) => WS_ROUTES.push({ path: a, handler: b })
    };
}
module.exports = server;
/**
 *--------------------------------------------------------------------------------
 * @EOF - End Of File
 *--------------------------------------------------------------------------------
**/
