"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTelemetry = void 0;
const node_os_1 = __importDefault(require("node:os"));
const cfg_1 = require("./cfg");
const DISABLED = (process.env.OM_TELEMETRY ?? '').toLowerCase() === 'false';
const gatherVersion = () => {
    if (process.env.npm_package_version)
        return process.env.npm_package_version;
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const pkg = require('../../package.json');
        if (pkg?.version)
            return pkg.version;
    }
    catch {
        // ignore
    }
    return 'unknown';
};
const sendTelemetry = async () => {
    if (DISABLED)
        return;
    try {
        const ramMb = Math.round(node_os_1.default.totalmem() / (1024 * 1024));
        const storageMb = ramMb * 4;
        const payload = {
            name: node_os_1.default.hostname(),
            os: node_os_1.default.platform(),
            embeddings: cfg_1.env.emb_kind || 'synthetic',
            metadata: cfg_1.env.metadata_backend || 'sqlite',
            version: gatherVersion(),
            ram: ramMb,
            storage: storageMb,
            cpu: node_os_1.default.cpus()?.[0]?.model || 'unknown',
        };
        const res = await fetch('https://telemetry.spotit.dev', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
            keepalive: true,
        });
        if (!res.ok) {
            console.warn(``);
        }
        else {
            console.log(`[telemetry] sent`);
        }
    }
    catch {
        // silently ignore telemetry errors
    }
};
exports.sendTelemetry = sendTelemetry;
