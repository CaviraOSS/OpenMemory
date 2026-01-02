"use strict";
/**
 * google drive source for openmemory - production grade
 * requires: googleapis
 * env vars: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON
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
exports.google_drive_source = void 0;
const base_1 = require("./base");
class google_drive_source extends base_1.base_source {
    name = 'google_drive';
    service = null;
    auth = null;
    async _connect(creds) {
        let google;
        try {
            google = await Promise.resolve().then(() => __importStar(require('googleapis'))).then(m => m.google);
        }
        catch {
            throw new base_1.source_config_error('missing deps: npm install googleapis', this.name);
        }
        const scopes = ['https://www.googleapis.com/auth/drive.readonly'];
        if (creds.credentials_json) {
            this.auth = new google.auth.GoogleAuth({
                credentials: creds.credentials_json,
                scopes
            });
        }
        else if (creds.service_account_file) {
            this.auth = new google.auth.GoogleAuth({
                keyFile: creds.service_account_file,
                scopes
            });
        }
        else if (process.env.GOOGLE_CREDENTIALS_JSON) {
            this.auth = new google.auth.GoogleAuth({
                credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON),
                scopes
            });
        }
        else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
            this.auth = new google.auth.GoogleAuth({
                keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE,
                scopes
            });
        }
        else {
            throw new base_1.source_config_error('no credentials: set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON', this.name);
        }
        this.service = google.drive({ version: 'v3', auth: this.auth });
        return true;
    }
    async _list_items(filters) {
        const q_parts = ['trashed=false'];
        if (filters.folder_id) {
            q_parts.push(`'${filters.folder_id}' in parents`);
        }
        if (filters.mime_types?.length) {
            const mime_q = filters.mime_types.map((m) => `mimeType='${m}'`).join(' or ');
            q_parts.push(`(${mime_q})`);
        }
        const query = q_parts.join(' and ');
        const results = [];
        let page_token;
        do {
            const resp = await this.service.files.list({
                q: query,
                spaces: 'drive',
                fields: 'nextPageToken, files(id, name, mimeType, modifiedTime, size)',
                pageToken: page_token,
                pageSize: 100
            });
            for (const f of resp.data.files || []) {
                results.push({
                    id: f.id,
                    name: f.name,
                    type: f.mimeType,
                    modified: f.modifiedTime,
                    size: f.size
                });
            }
            page_token = resp.data.nextPageToken;
        } while (page_token);
        return results;
    }
    async _fetch_item(item_id) {
        const meta = await this.service.files.get({
            fileId: item_id,
            fields: 'id,name,mimeType'
        });
        const mime = meta.data.mimeType;
        let text = '';
        let data = '';
        // google docs -> export as text
        if (mime === 'application/vnd.google-apps.document') {
            const resp = await this.service.files.export({ fileId: item_id, mimeType: 'text/plain' });
            text = resp.data;
            data = text;
        }
        // google sheets -> export as csv
        else if (mime === 'application/vnd.google-apps.spreadsheet') {
            const resp = await this.service.files.export({ fileId: item_id, mimeType: 'text/csv' });
            text = resp.data;
            data = text;
        }
        // google slides -> export as plain text
        else if (mime === 'application/vnd.google-apps.presentation') {
            const resp = await this.service.files.export({ fileId: item_id, mimeType: 'text/plain' });
            text = resp.data;
            data = text;
        }
        // other files -> download raw
        else {
            const resp = await this.service.files.get({ fileId: item_id, alt: 'media' }, { responseType: 'arraybuffer' });
            data = Buffer.from(resp.data);
            try {
                text = data.toString('utf-8');
            }
            catch {
                text = '';
            }
        }
        return {
            id: item_id,
            name: meta.data.name,
            type: mime,
            text,
            data,
            meta: { source: 'google_drive', file_id: item_id, mime_type: mime }
        };
    }
}
exports.google_drive_source = google_drive_source;
