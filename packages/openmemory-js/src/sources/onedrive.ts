/**
 * onedrive source for openmemory - production grade
 * requires: @azure/msal-node
 * env vars: AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID
 */

import { base_source, source_config_error, source_auth_error, source_item, source_content } from './base';

export class onedrive_source extends base_source {
    name = 'onedrive';
    private access_token: string | null = null;
    private graph_url = 'https://graph.microsoft.com/v1.0';

    async _connect(creds: Record<string, any>): Promise<boolean> {
        if (creds.access_token) {
            this.access_token = creds.access_token;
            return true;
        }

        let msal: any;
        try {
            msal = await import('@azure/msal-node');
        } catch {
            throw new source_config_error('missing deps: npm install @azure/msal-node', this.name);
        }

        const client_id = creds.client_id || process.env.AZURE_CLIENT_ID;
        const client_secret = creds.client_secret || process.env.AZURE_CLIENT_SECRET;
        const tenant_id = creds.tenant_id || process.env.AZURE_TENANT_ID;

        if (!client_id || !client_secret || !tenant_id) {
            throw new source_config_error(
                'no credentials: set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID',
                this.name
            );
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

        throw new source_auth_error('auth failed: no access token returned', this.name);
    }

    async _list_items(filters: Record<string, any>): Promise<source_item[]> {
        const folder_path = filters.folder_path || '/';
        const user_principal = filters.user_principal;

        const base = user_principal
            ? `${this.graph_url}/users/${user_principal}/drive`
            : `${this.graph_url}/me/drive`;

        const url = folder_path === '/'
            ? `${base}/root/children`
            : `${base}/root:/${folder_path.replace(/^\/|\/$/g, '')}:/children`;

        const results: source_item[] = [];
        let next_url: string | null = url;

        while (next_url) {
            const resp: Response = await fetch(next_url, {
                headers: { Authorization: `Bearer ${this.access_token}` }
            });

            if (!resp.ok) throw new Error(`http ${resp.status}: ${resp.statusText}`);

            const data: any = await resp.json();

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

    async _fetch_item(item_id: string): Promise<source_content> {
        const base = `${this.graph_url}/me/drive`;

        const meta_resp = await fetch(`${base}/items/${item_id}`, {
            headers: { Authorization: `Bearer ${this.access_token}` }
        });

        if (!meta_resp.ok) throw new Error(`http ${meta_resp.status}`);
        const meta = await meta_resp.json();

        const content_resp = await fetch(`${base}/items/${item_id}/content`, {
            headers: { Authorization: `Bearer ${this.access_token}` },
            redirect: 'follow'
        });

        if (!content_resp.ok) throw new Error(`http ${content_resp.status}`);
        const data = Buffer.from(await content_resp.arrayBuffer());

        let text = '';
        try {
            text = data.toString('utf-8');
        } catch { }

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
