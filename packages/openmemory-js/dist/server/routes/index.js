"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.routes = routes;
const system_1 = require("./system");
const memory_1 = require("./memory");
const dynamics_1 = require("./dynamics");
const ide_1 = require("./ide");
const compression_1 = require("./compression");
const langgraph_1 = require("./langgraph");
const users_1 = require("./users");
const temporal_1 = require("./temporal");
const dashboard_1 = require("./dashboard");
const vercel_1 = require("./vercel");
const sources_1 = require("./sources");
function routes(app) {
    (0, system_1.sys)(app);
    (0, memory_1.mem)(app);
    (0, dynamics_1.dynroutes)(app);
    (0, ide_1.ide)(app);
    (0, compression_1.compression)(app);
    (0, langgraph_1.lg)(app);
    (0, users_1.usr)(app);
    (0, temporal_1.temporal)(app);
    (0, dashboard_1.dash)(app);
    (0, vercel_1.vercel)(app);
    (0, sources_1.src)(app);
}
