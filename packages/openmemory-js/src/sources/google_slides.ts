/**
 * google slides source for openmemory - production grade
 * requires: googleapis
 * env vars: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON
 */

import { base_source, source_config_error, source_item, source_content } from './base';

export class google_slides_source extends base_source {
    name = 'google_slides';
    private service: any = null;
    private auth: any = null;

    async _connect(creds: Record<string, any>): Promise<boolean> {
        let google: any;
        try {
            google = await import('googleapis').then(m => m.google);
        } catch {
            throw new source_config_error('missing deps: npm install googleapis', this.name);
        }

        const scopes = ['https://www.googleapis.com/auth/presentations.readonly'];

        if (creds.credentials_json) {
            this.auth = new google.auth.GoogleAuth({ credentials: creds.credentials_json, scopes });
        } else if (creds.service_account_file) {
            this.auth = new google.auth.GoogleAuth({ keyFile: creds.service_account_file, scopes });
        } else if (process.env.GOOGLE_CREDENTIALS_JSON) {
            this.auth = new google.auth.GoogleAuth({ credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON), scopes });
        } else if (process.env.GOOGLE_SERVICE_ACCOUNT_FILE) {
            this.auth = new google.auth.GoogleAuth({ keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_FILE, scopes });
        } else {
            throw new source_config_error('no credentials: set GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON', this.name);
        }

        this.service = google.slides({ version: 'v1', auth: this.auth });
        return true;
    }

    async _list_items(filters: Record<string, any>): Promise<source_item[]> {
        if (!filters.presentation_id) {
            throw new source_config_error('presentation_id is required', this.name);
        }

        const pres = await this.service.presentations.get({ presentationId: filters.presentation_id });

        return (pres.data.slides || []).map((slide: any, i: number) => ({
            id: `${filters.presentation_id}#${slide.objectId}`,
            name: `Slide ${i + 1}`,
            type: 'slide',
            index: i,
            presentation_id: filters.presentation_id,
            object_id: slide.objectId
        }));
    }

    async _fetch_item(item_id: string): Promise<source_content> {
        const [presentation_id, slide_id] = item_id.includes('#')
            ? item_id.split('#', 2)
            : [item_id, null];

        const pres = await this.service.presentations.get({ presentationId: presentation_id });

        const extract_text = (element: any): string => {
            const texts: string[] = [];

            if (element.shape?.text) {
                for (const te of element.shape.text.textElements || []) {
                    if (te.textRun) texts.push(te.textRun.content || '');
                }
            }

            if (element.table) {
                for (const row of element.table.tableRows || []) {
                    for (const cell of row.tableCells || []) {
                        if (cell.text) {
                            for (const te of cell.text.textElements || []) {
                                if (te.textRun) texts.push(te.textRun.content || '');
                            }
                        }
                    }
                }
            }

            return texts.join('');
        };

        const all_text: string[] = [];

        for (let i = 0; i < (pres.data.slides || []).length; i++) {
            const slide = pres.data.slides![i];
            if (slide_id && slide.objectId !== slide_id) continue;

            const slide_texts = [`## Slide ${i + 1}`];

            for (const element of slide.pageElements || []) {
                const txt = extract_text(element);
                if (txt.trim()) slide_texts.push(txt.trim());
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
