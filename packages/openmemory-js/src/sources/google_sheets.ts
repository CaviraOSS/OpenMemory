/**
 * google sheets source for openmemory - production grade
 * requires: googleapis
 * env vars: GOOGLE_SERVICE_ACCOUNT_FILE or GOOGLE_CREDENTIALS_JSON
 */

import { base_source, source_config_error, source_item, source_content } from './base';

export class google_sheets_source extends base_source {
    name = 'google_sheets';
    private service: any = null;
    private auth: any = null;

    async _connect(creds: Record<string, any>): Promise<boolean> {
        let google: any;
        try {
            google = await import('googleapis').then(m => m.google);
        } catch {
            throw new source_config_error('missing deps: npm install googleapis', this.name);
        }

        const scopes = ['https://www.googleapis.com/auth/spreadsheets.readonly'];

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

        this.service = google.sheets({ version: 'v4', auth: this.auth });
        return true;
    }

    async _list_items(filters: Record<string, any>): Promise<source_item[]> {
        if (!filters.spreadsheet_id) {
            throw new source_config_error('spreadsheet_id is required', this.name);
        }

        const meta = await this.service.spreadsheets.get({ spreadsheetId: filters.spreadsheet_id });

        return (meta.data.sheets || []).map((sheet: any, i: number) => ({
            id: `${filters.spreadsheet_id}!${sheet.properties?.title || 'Sheet1'}`,
            name: sheet.properties?.title || 'Sheet1',
            type: 'sheet',
            index: i,
            spreadsheet_id: filters.spreadsheet_id
        }));
    }

    async _fetch_item(item_id: string): Promise<source_content> {
        const [spreadsheet_id, sheet_range] = item_id.includes('!')
            ? item_id.split('!', 2)
            : [item_id, 'A:ZZ'];

        const result = await this.service.spreadsheets.values.get({
            spreadsheetId: spreadsheet_id,
            range: sheet_range
        });

        const values = result.data.values || [];


        const lines = values.map((row: any[], i: number) => {
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
