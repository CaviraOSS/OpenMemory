/*
*      __                      __  ___                               
*     / /   ____  ____  ____ _/  |/  /__  ____ ___  ____  _______  __
*    / /   / __ \/ __ \/ __ `/ /|_/ / _ \/ __ `__ \/ __ \/ ___/ / / /
*   / /___/ /_/ / / / / /_/ / /  / /  __/ / / / / / /_/ / /  / /_/ / 
*  /_____/\____/_/ /_/\__, /_/  /_/\___/_/ /_/ /_/\____/_/   \__, /  
                     /____/                                 /____/   
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/connectors/registry.ts
 *  usage : implements the LongMemory registry component
 */

import { ConnectorRegistry } from '../core/connectors/connector_registry.js';
import { configurable_connector } from './configurable_connector.js';
import { docs_connector } from './docs/docs_connector.js';
import { map_email_to_hydrograph, map_pdf_to_hydrograph } from './domain_mapper.js';
import { github_connector } from './github/github_connector.js';
import { local_file_connector } from './local/local_file_connector.js';
import { markdown_connector } from './local/markdown_connector.js';
import { mock_connector } from './mock_connector.js';
import { configurable_connector_definitions, type connector_service_auth, type connector_service_category, type service_connector_definition } from './service_catalog.js';
import { rss_connector, sitemap_connector, website_connector } from './web/website_connector.js';
import { youtube_connector } from './youtube/youtube_connector.js';
import { document_connector } from './extraction/document_connector.js';
import { google_drive_connector, google_sheets_connector, google_slides_connector, notion_connector, onedrive_connector } from './cloud/cloud_connectors.js';

export type connector_definition = {
    id: string;
    name: string;
    source_type: string;
    status: 'real' | 'starter' | 'configurable' | 'mock';
    category: connector_service_category;
    auth: connector_service_auth;
    credential_env: string[];
    documentation_url: string;
    required_config: string[];
    maps: string[];
};

const built_in_connector_definitions: connector_definition[] = [
    { id: 'youtube', name: 'YouTube', source_type: 'youtube', status: 'starter', category: 'web', auth: 'api_key', credential_env: ['YOUTUBE_API_KEY'], documentation_url: 'https://developers.google.com/youtube/v3', required_config: [], maps: ['video metadata', 'transcript segments', 'timestamps', 'channels', 'speakers', 'topics'] },
    { id: 'github', name: 'GitHub', source_type: 'github', status: 'real', category: 'code', auth: 'token', credential_env: ['GITHUB_TOKEN', 'GH_TOKEN'], documentation_url: 'https://docs.github.com/rest', required_config: ['owner', 'repo'], maps: ['repositories', 'README/docs', 'issues', 'pull requests', 'commits', 'files', 'comments'] },
    { id: 'docs', name: 'Drive / Notion-style documents', source_type: 'document', status: 'starter', category: 'knowledge', auth: 'none', credential_env: [], documentation_url: 'https://github.com/CaviraOSS/LongMemory/blob/main/docs/connectors.md', required_config: [], maps: ['documents', 'headings', 'sections', 'versions', 'citations'] },
    { id: 'markdown', name: 'Markdown files', source_type: 'markdown', status: 'real', category: 'local', auth: 'none', credential_env: [], documentation_url: 'https://spec.commonmark.org/', required_config: ['root'], maps: ['headings', 'sections', 'code fences', 'line citations'] },
    { id: 'pdf', name: 'PDF documents', source_type: 'pdf', status: 'real', category: 'knowledge', auth: 'none', credential_env: [], documentation_url: 'https://opensource.adobe.com/dc-acrobat-sdk-docs/pdfstandards/', required_config: ['root'], maps: ['documents', 'pages', 'metadata', 'page citations'] },
    { id: 'document', name: 'Documents', source_type: 'document', status: 'real', category: 'knowledge', auth: 'none', credential_env: [], documentation_url: 'https://github.com/CaviraOSS/LongMemory', required_config: ['root'], maps: ['PDF', 'DOCX', 'HTML', 'Markdown', 'text', 'sections', 'citations'] },
    { id: 'media', name: 'Audio and video', source_type: 'media', status: 'real', category: 'knowledge', auth: 'api_key', credential_env: ['OPENAI_API_KEY'], documentation_url: 'https://platform.openai.com/docs/guides/speech-to-text', required_config: ['root'], maps: ['audio', 'video', 'transcripts', 'duration', 'language'] },
    { id: 'google_drive', name: 'Google Drive', source_type: 'google_drive', status: 'real', category: 'cloud_storage', auth: 'oauth', credential_env: ['GOOGLE_ACCESS_TOKEN'], documentation_url: 'https://developers.google.com/drive/api/reference/rest/v3', required_config: [], maps: ['files', 'folders', 'native documents', 'binary documents', 'versions'] },
    { id: 'google_sheets', name: 'Google Sheets', source_type: 'google_sheets', status: 'real', category: 'knowledge', auth: 'oauth', credential_env: ['GOOGLE_ACCESS_TOKEN'], documentation_url: 'https://developers.google.com/sheets/api/reference/rest', required_config: [], maps: ['spreadsheets', 'sheets', 'rows', 'formulas', 'metadata'] },
    { id: 'google_slides', name: 'Google Slides', source_type: 'google_slides', status: 'real', category: 'knowledge', auth: 'oauth', credential_env: ['GOOGLE_ACCESS_TOKEN'], documentation_url: 'https://developers.google.com/slides/api/reference/rest', required_config: [], maps: ['presentations', 'slides', 'shape text', 'metadata'] },
    { id: 'onedrive', name: 'OneDrive', source_type: 'onedrive', status: 'real', category: 'cloud_storage', auth: 'oauth', credential_env: ['MICROSOFT_GRAPH_TOKEN'], documentation_url: 'https://learn.microsoft.com/graph/api/resources/onedrive', required_config: [], maps: ['files', 'folders', 'Office documents', 'versions'] },
    { id: 'notion', name: 'Notion', source_type: 'notion', status: 'real', category: 'knowledge', auth: 'token', credential_env: ['NOTION_API_KEY'], documentation_url: 'https://developers.notion.com/reference/intro', required_config: [], maps: ['pages', 'blocks', 'headings', 'lists', 'properties'] },
    { id: 'website', name: 'Websites', source_type: 'website', status: 'real', category: 'web', auth: 'none', credential_env: [], documentation_url: 'https://developer.mozilla.org/docs/Web/API/Fetch_API', required_config: ['urls'], maps: ['pages', 'sections', 'links', 'freshness'] },
    { id: 'sitemap', name: 'XML Sitemap', source_type: 'website', status: 'real', category: 'web', auth: 'none', credential_env: [], documentation_url: 'https://www.sitemaps.org/protocol.html', required_config: ['sitemap_url'], maps: ['page discovery', 'sections', 'links', 'freshness'] },
    { id: 'rss', name: 'RSS / Atom', source_type: 'feed', status: 'real', category: 'web', auth: 'none', credential_env: [], documentation_url: 'https://www.rssboard.org/rss-specification', required_config: ['feed_url'], maps: ['feeds', 'entries', 'linked pages', 'publication time'] },
    { id: 'email', name: 'Email', source_type: 'email', status: 'mock', category: 'communication', auth: 'oauth', credential_env: [], documentation_url: 'https://datatracker.ietf.org/doc/html/rfc5322', required_config: [], maps: ['mailboxes', 'threads', 'messages', 'attachments', 'participants'] },
    { id: 'local', name: 'Local folders', source_type: 'local_file', status: 'real', category: 'local', auth: 'none', credential_env: [], documentation_url: 'https://nodejs.org/api/fs.html', required_config: ['root'], maps: ['folders', 'Markdown', 'text', 'JSON', 'paths', 'modified time'] },
    { id: 'generic_api', name: 'Generic API', source_type: 'generic_api', status: 'configurable', category: 'database', auth: 'token', credential_env: [], documentation_url: 'https://developer.mozilla.org/docs/Web/HTTP', required_config: ['list_url', 'item_url', 'fields'], maps: ['records', 'events', 'permissions', 'versions'] },
];

export const connector_definitions: connector_definition[] = [
    ...built_in_connector_definitions,
    ...configurable_connector_definitions.filter((definition) => !built_in_connector_definitions.some((built_in) => built_in.id === definition.id)),
];

export function create_connector_registry(): ConnectorRegistry {
    const registry = new ConnectorRegistry();
    registry.register('youtube', () => new youtube_connector());
    registry.register('github', (config) => new github_connector(config as unknown as ConstructorParameters<typeof github_connector>[0]));
    registry.register('docs', () => new docs_connector());
    registry.register('local', (config) => new local_file_connector(config as unknown as ConstructorParameters<typeof local_file_connector>[0]));
    registry.register('markdown', (config) => new markdown_connector(config as unknown as ConstructorParameters<typeof markdown_connector>[0]));
    registry.register('website', (config) => new website_connector(config as unknown as ConstructorParameters<typeof website_connector>[0]));
    registry.register('sitemap', (config) => new sitemap_connector(config as unknown as ConstructorParameters<typeof sitemap_connector>[0]));
    registry.register('rss', (config) => new rss_connector(config as unknown as ConstructorParameters<typeof rss_connector>[0]));
    registry.register('pdf', (config) => new document_connector(Object.assign({}, config, { id: 'pdf', include: 'pdf' }) as ConstructorParameters<typeof document_connector>[0]));
    registry.register('document', (config) => new document_connector(Object.assign({}, config, { id: 'document', include: 'documents' }) as ConstructorParameters<typeof document_connector>[0]));
    registry.register('media', (config) => new document_connector(Object.assign({}, config, { id: 'media', include: 'media' }) as ConstructorParameters<typeof document_connector>[0]));
    registry.register('google_drive', (config) => new google_drive_connector(config));
    registry.register('google_sheets', (config) => new google_sheets_connector(config));
    registry.register('google_slides', (config) => new google_slides_connector(config));
    registry.register('onedrive', (config) => new onedrive_connector(config));
    registry.register('notion', (config) => new notion_connector(config));
    const generic = built_in_connector_definitions.find((definition) => definition.id === 'generic_api') as connector_definition;
    registry.register('generic_api', (config) => new configurable_connector(generic as service_connector_definition, config as never));
    for (const definition of configurable_connector_definitions.filter((item) => !registry.has(item.id))) {
        registry.register(definition.id, (config) => new configurable_connector(definition, config as never));
    }
    for (const definition of built_in_connector_definitions.filter((item) => !registry.has(item.id))) {
        registry.register(definition.id, () => new mock_connector(definition.id, definition.name, definition.source_type,
            definition.id === 'email' ? 'message' : 'document',
            definition.id === 'email' ? map_email_to_hydrograph : definition.id === 'pdf' ? map_pdf_to_hydrograph : undefined));
    }
    return registry;
}

export const default_connector_registry = create_connector_registry();