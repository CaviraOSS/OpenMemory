"use strict";
/**
 * onedrive source for openmemory - production grade
 * requires: @azure/msal-node
 * env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onedrive_source = void 0;
const base_1 = require("./base");
class onedrive_source extends base_1.base_source {
    name = 'onedrive';
    access_token = null;
    graph_url = 'https://graph.microsoft.com/v1.0';
    async _connect(creds) {
        if (creds.access_token) {
            this.access_token = creds.access_token;
            return true;
        }
        let msal;
        try {
            msal = await Promise.resolve().then(() => __importStar(require('@azure/msal-node')));
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install @azure/msal-node', this.name);
        }
        const client_id = creds.client_id || process.env.AZURE_CLIENT_ID;
        const client_secret = creds.client_secret || process.env.AZURE_CLIENT_SECRET;
        const tenant_id = creds.tenant_id || process.env.AZURE_TENANT_ID;
        if (!client_id || !client_secret || !tenant_id) {
            throw new base_1.source_config_error('no credentials: set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID', this.name);
        }
        const app = new msal.ConfidentialClientApplication({
            auth: {
                clientId: client_id,
                clientSecret: client_secret,
                authority: `https://login.microsoftonline.com/${tenant_id}`
            }
        });
        const result = await app.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default']
        });
        if (result?.accessToken) {
            this.access_token = result.accessToken;
            return true;
        }
        throw new base_1.source_auth_error('auth failed: no access token returned', this.name);
    }
    async _list_items(filters) {
        const folder_path = filters.folder_path || '/';
        const user_principal = filters.user_principal;
        const base = user_principal
            ? `${this.graph_url}/users/${user_principal}/drive`
            : `${this.graph_url}/me/drive`;
        const url = folder_path === '/'
            ? `${base}/root/children`
            : `${base}/root:/${folder_path.replace(/^\/|\/$/g, '')}:/children`;
        const results = [];
        let next_url = url;
        while (next_url) {
            const resp = await fetch(next_url, {
                headers: { Authorization: `Bearer ${this.access_token}` }
            });
            if (!resp.ok)
                throw new Error(`http ${resp.status}: ${resp.statusText}`);
            const data = await resp.json();
            for (const item of data.value || []) {
                results.push({
                    id: item.id,
                    name: item.name,
                    type: 'folder' in item ? 'folder' : item.file?.mimeType || 'file',
                    size: item.size || 0,
                    modified: item.lastModifiedDateTime,
                    path: item.parentReference?.path || ''
                });
            }
            next_url = data['@odata.nextLink'] || null;
        }
        return results;
    }
    async _fetch_item(item_id) {
        const base = `${this.graph_url}/me/drive`;
        const meta_resp = await fetch(`${base}/items/${item_id}`, {
            headers: { Authorization: `Bearer ${this.access_token}` }
        });
        if (!meta_resp.ok)
            throw new Error(`http ${meta_resp.status}`);
        const meta = await meta_resp.json();
        const content_resp = await fetch(`${base}/items/${item_id}/content`, {
            headers: { Authorization: `Bearer ${this.access_token}` },
            redirect: 'follow'
        });
        if (!content_resp.ok)
            throw new Error(`http ${content_resp.status}`);
        const data = Buffer.from(await content_resp.arrayBuffer());
        let text = '';
        try {
            text = data.toString('utf-8');
        }
        catch { }
        return {
            id: item_id,
            name: meta.name || 'unknown',
            type: meta.file?.mimeType || 'unknown',
            text,
            data,
            meta: { source: 'onedrive', item_id, size: meta.size || 0, mime_type: meta.file?.mimeType || '' }
        };
    }
}
exports.onedrive_source = onedrive_source;
