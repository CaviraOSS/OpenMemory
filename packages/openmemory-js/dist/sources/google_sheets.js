"use strict";
/**
 * google sheets source for openmemory - production grade
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
exports.google_sheets_source = void 0;
const base_1 = require("./base");
class google_sheets_source extends base_1.base_source {
    name = 'google_sheets';
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
        const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
        if (creds.credentials_json) {
            this.auth = new google.auth.GoogleAuth({ credentials: creds.credentials_json, scopes });
        }
        else if (creds.service_account_file) {
            this.auth = new google.auth.GoogleAuth({ keyFile: creds.service_account_file, scopes });
        }
        else if (process.env.GOOGLE_CREDENTIALS_JSON) {
            this.auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes });
        }
        else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
            this.auth = new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE, scopes });
        }
        else {
            throw new base_1.source_config_error('no credentials: set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON', this.name);
        }
        this.service = google.sheets({ version: 'v4', auth: this.auth });
        return true;
    }
    async _list_items(filters) {
        if (!filters.spreadsheet_id) {
            throw new base_1.source_config_error('spreadsheet_id is required', this.name);
        }
        const meta = await this.service.spreadsheets.get({ spreadsheetId: filters.spreadsheet_id });
        return (meta.data.sheets || []).map((sheet, i) => ({
            id: `${filters.spreadsheet_id}!${sheet.properties?.title || 'Sheet1'}`,
            name: sheet.properties?.title || 'Sheet1',
            type: 'sheet',
            index: i,
            spreadsheet_id: filters.spreadsheet_id
        }));
    }
    async _fetch_item(item_id) {
        const [spreadsheet_id, sheet_range] = item_id.includes('!')
            ? item_id.split('!', 2)
            : [item_id, 'A:ZZ'];
        const result = await this.service.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: sheet_range
        });
        const values = result.data.values || [];
        // convert to markdown table
        const lines = values.map((row, i) => {
            const line = row.map(String).join(' | ');
            return i === 0 ? `${line}\n${row.map(() => '---').join(' | ')}` : line;
        });
        const text = lines.join('\n');
        return {
            id: item_id,
            name: sheet_range,
            type: 'spreadsheet',
            text,
            data: text,
            meta: { source: 'google_sheets', spreadsheet_id, range: sheet_range, row_count: values.length }
        };
    }
}
exports.google_sheets_source = google_sheets_source;
