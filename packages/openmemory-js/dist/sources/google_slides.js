"use strict";
/**
 * google slides source for openmemory - production grade
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
exports.google_slides_source = void 0;
const base_1 = require("./base");
class google_slides_source extends base_1.base_source {
    name = 'google_slides';
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
        const scopes = ['https://www.googleapis.com/auth/presentations.readonly'];
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
        this.service = google.slides({ version: 'v1', auth: this.auth });
        return true;
    }
    async _list_items(filters) {
        if (!filters.presentation_id) {
            throw new base_1.source_config_error('presentation_id is required', this.name);
        }
        const pres = await this.service.presentations.get({ presentationId: filters.presentation_id });
        return (pres.data.slides || []).map((slide, i) => ({
            id: `${filters.presentation_id}#${slide.objectId}`,
            name: `Slide ${i + 1}`,
            type: 'slide',
            index: i,
            presentation_id: filters.presentation_id,
            object_id: slide.objectId
        }));
    }
    async _fetch_item(item_id) {
        const [presentation_id, slide_id] = item_id.includes('#')
            ? item_id.split('#', 2)
            : [item_id, null];
        const pres = await this.service.presentations.get({ presentationId: presentation_id });
        const extract_text = (element) => {
            const texts = [];
            if (element.shape?.text) {
                for (const te of element.shape.text.textElements || []) {
                    if (te.textRun)
                        texts.push(te.textRun.content || '');
                }
            }
            if (element.table) {
                for (const row of element.table.tableRows || []) {
                    for (const cell of row.tableCells || []) {
                        if (cell.text) {
                            for (const te of cell.text.textElements || []) {
                                if (te.textRun)
                                    texts.push(te.textRun.content || '');
                            }
                        }
                    }
                }
            }
            return texts.join('');
        };
        const all_text = [];
        for (let i = 0; i < (pres.data.slides || []).length; i++) {
            const slide = pres.data.slides[i];
            if (slide_id && slide.objectId !== slide_id)
                continue;
            const slide_texts = [`## Slide ${i + 1}`];
            for (const element of slide.pageElements || []) {
                const txt = extract_text(element);
                if (txt.trim())
                    slide_texts.push(txt.trim());
            }
            all_text.push(...slide_texts);
        }
        const text = all_text.join('\n\n');
        return {
            id: item_id,
            name: pres.data.title || 'Untitled Presentation',
            type: 'presentation',
            text,
            data: text,
            meta: { source: 'google_slides', presentation_id, slide_count: pres.data.slides?.length || 0 }
        };
    }
}
exports.google_slides_source = google_slides_source;
