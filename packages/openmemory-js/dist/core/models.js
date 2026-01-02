"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.get_provider_config = exports.get_model = exports.load_models = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
let cfg = null;
const load_models = () => {
    if (cfg)
        return cfg;
    const p = (0, path_1.join)(__dirname, "../../../models.yml");
    if (!(0, fs_1.existsSync)(p)) {
        console.error("[MODELS] models.yml not found, using defaults");
        return get_defaults();
    }
    try {
        const yml = (0, fs_1.readFileSync)(p, "utf-8");
        cfg = parse_yaml(yml);
        console.error(`[MODELS] Loaded models.yml (${Object.keys(cfg).length} sectors)`);
        return cfg;
    }
    catch (e) {
        console.error("[MODELS] Failed to parse models.yml:", e);
        return get_defaults();
    }
};
exports.load_models = load_models;
const parse_yaml = (yml) => {
    const lines = yml.split("\n");
    const obj = {};
    let cur_sec = null;
    for (const line of lines) {
        const trim = line.trim();
        if (!trim || trim.startsWith("#"))
            continue;
        const indent = line.search(/\S/);
        const [key, ...val_parts] = trim.split(":");
        const val = val_parts.join(":").trim();
        if (indent === 0 && val) {
            continue;
        }
        else if (indent === 0) {
            cur_sec = key;
            obj[cur_sec] = {};
        }
        else if (cur_sec && val) {
            obj[cur_sec][key] = val;
        }
    }
    return obj;
};
const get_defaults = () => ({
    episodic: {
        ollama: "nomic-embed-text",
        openai: "text-embedding-3-small",
        gemini: "models/embedding-001",
        aws: "amazon.titan-embed-text-v2:0",
        local: "all-MiniLM-L6-v2",
    },
    semantic: {
        ollama: "nomic-embed-text",
        openai: "text-embedding-3-small",
        gemini: "models/embedding-001",
        aws: "amazon.titan-embed-text-v2:0",
        local: "all-MiniLM-L6-v2",
    },
    procedural: {
        ollama: "nomic-embed-text",
        openai: "text-embedding-3-small",
        gemini: "models/embedding-001",
        aws: "amazon.titan-embed-text-v2:0",
        local: "all-MiniLM-L6-v2",
    },
    emotional: {
        ollama: "nomic-embed-text",
        openai: "text-embedding-3-small",
        gemini: "models/embedding-001",
        aws: "amazon.titan-embed-text-v2:0",
        local: "all-MiniLM-L6-v2",
    },
    reflective: {
        ollama: "nomic-embed-text",
        openai: "text-embedding-3-large",
        gemini: "models/embedding-001",
        aws: "amazon.titan-embed-text-v2:0",
        local: "all-mpnet-base-v2",
    },
});
const get_model = (sector, provider) => {
    // Environment variable overrides
    if (provider === "ollama" && process.env.OM_OLLAMA_MODEL) {
        return process.env.OM_OLLAMA_MODEL;
    }
    if (provider === "openai" && process.env.OM_OPENAI_MODEL) {
        return process.env.OM_OPENAI_MODEL;
    }
    const cfg = (0, exports.load_models)();
    return (cfg[sector]?.[provider] ||
        cfg.semantic?.[provider] ||
        "nomic-embed-text");
};
exports.get_model = get_model;
const get_provider_config = (provider) => {
    return {};
};
exports.get_provider_config = get_provider_config;
