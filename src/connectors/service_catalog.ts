/*
 *   _____                 ___  ___
 *  |  _  |                |  \/  |
 *  | | | |_ __   ___ _ __ | .  . | ___ _ __ ___   ___  _ __ _   _
 *  | | | | '_ \ / _ \ '_ \| |\/| |/ _ \ '_ ` _ \ / _ \| '__| | | |
 *  \ \_/ / |_) |  __/ | | | |  | |  __/ | | | | | (_) | |  | |_| |
 *   \___/| .__/ \___|_| |_\_|  |_/\___|_| |_| |_|\___/|_|   \__, |
 *        | |                                                 __/ |
 *        |_|                                                |___/
 *
 *  cavira oss (c) 2026  -  nullure (c) 2026
 *  ----------------------------------------------------------
 *  file  : src/connectors/service_catalog.ts
 *  usage : configurable external connector catalog
 */

export type connector_service_category = 'code' | 'cloud_storage' | 'knowledge' | 'communication' | 'project' | 'web' | 'database' | 'local';
export type connector_service_auth = 'none' | 'token' | 'oauth' | 'api_key' | 'connection_string' | 'service_account';

export type service_connector_definition = {
    id: string;
    name: string;
    source_type: string;
    status: 'configurable';
    category: connector_service_category;
    auth: connector_service_auth;
    credential_env: string[];
    documentation_url: string;
    maps: string[];
    required_config: string[];
};

export const configurable_connector_definitions: service_connector_definition[] = [
    ['gitlab', 'GitLab', 'code', 'token', ['GITLAB_TOKEN'], 'https://docs.gitlab.com/api/', 'Repositories, files, merge requests, issues, commits, and releases.'],
    ['bitbucket', 'Bitbucket', 'code', 'token', ['BITBUCKET_TOKEN'], 'https://developer.atlassian.com/cloud/bitbucket/rest/', 'Workspaces, repositories, source files, pull requests, and commits.'],
    ['azure_devops', 'Azure DevOps', 'code', 'token', ['AZURE_DEVOPS_TOKEN'], 'https://learn.microsoft.com/rest/api/azure/devops/', 'Projects, repositories, work items, builds, and pull requests.'],
    ['gitea', 'Gitea', 'code', 'token', ['GITEA_TOKEN'], 'https://docs.gitea.com/api/1.20/', 'Repositories, files, issues, pulls, and releases from Gitea.'],
    ['forgejo', 'Forgejo', 'code', 'token', ['FORGEJO_TOKEN'], 'https://forgejo.org/docs/latest/user/api-usage/', 'Repositories and collaboration data from Forgejo.'],
    ['codeberg', 'Codeberg', 'code', 'token', ['CODEBERG_TOKEN'], 'https://docs.codeberg.org/advanced/access-token/', 'Codeberg repositories, issues, pulls, and files.'],
    ['google_drive', 'Google Drive', 'cloud_storage', 'oauth', ['GOOGLE_ACCESS_TOKEN'], 'https://developers.google.com/drive/api/reference/rest/v3', 'Files and folders from Google Drive.'],
    ['google_docs', 'Google Docs', 'knowledge', 'oauth', ['GOOGLE_ACCESS_TOKEN'], 'https://developers.google.com/docs/api/reference/rest', 'Structured Google Docs content.'],
    ['google_sheets', 'Google Sheets', 'knowledge', 'oauth', ['GOOGLE_ACCESS_TOKEN'], 'https://developers.google.com/sheets/api/reference/rest', 'Spreadsheet values, formulas, sheets, and metadata.'],
    ['google_slides', 'Google Slides', 'knowledge', 'oauth', ['GOOGLE_ACCESS_TOKEN'], 'https://developers.google.com/slides/api/reference/rest', 'Presentations, slides, notes, and shape text.'],
    ['onedrive', 'OneDrive', 'cloud_storage', 'oauth', ['MICROSOFT_GRAPH_TOKEN'], 'https://learn.microsoft.com/graph/api/resources/onedrive', 'Files and folders through Microsoft Graph.'],
    ['sharepoint', 'SharePoint', 'cloud_storage', 'oauth', ['MICROSOFT_GRAPH_TOKEN'], 'https://learn.microsoft.com/graph/api/resources/sharepoint', 'SharePoint sites, lists, pages, and documents.'],
    ['dropbox', 'Dropbox', 'cloud_storage', 'token', ['DROPBOX_ACCESS_TOKEN'], 'https://www.dropbox.com/developers/documentation/http/documentation', 'Dropbox files, folders, revisions, and search.'],
    ['box', 'Box', 'cloud_storage', 'oauth', ['BOX_ACCESS_TOKEN'], 'https://developer.box.com/reference/', 'Box files, folders, collaborations, and metadata.'],
    ['s3', 'Amazon S3', 'cloud_storage', 'service_account', ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'], 'https://docs.aws.amazon.com/AmazonS3/latest/API/Welcome.html', 'S3 objects and metadata through an HTTP gateway or signed endpoint.'],
    ['notion', 'Notion', 'knowledge', 'token', ['NOTION_API_KEY'], 'https://developers.notion.com/reference/intro', 'Pages, databases, blocks, comments, and properties.'],
    ['confluence', 'Confluence', 'knowledge', 'token', ['CONFLUENCE_TOKEN'], 'https://developer.atlassian.com/cloud/confluence/rest/v2/', 'Spaces, pages, blog posts, comments, and attachments.'],
    ['jira', 'Jira', 'project', 'token', ['JIRA_TOKEN'], 'https://developer.atlassian.com/cloud/jira/platform/rest/v3/', 'Issues, projects, comments, changelogs, and worklogs.'],
    ['linear', 'Linear', 'project', 'api_key', ['LINEAR_API_KEY'], 'https://linear.app/developers/graphql', 'Issues, projects, cycles, comments, and roadmaps.'],
    ['asana', 'Asana', 'project', 'token', ['ASANA_ACCESS_TOKEN'], 'https://developers.asana.com/reference/rest-api-reference', 'Tasks, projects, teams, stories, and attachments.'],
    ['trello', 'Trello', 'project', 'api_key', ['TRELLO_TOKEN'], 'https://developer.atlassian.com/cloud/trello/rest/', 'Boards, lists, cards, actions, and checklists.'],
    ['slack', 'Slack', 'communication', 'token', ['SLACK_BOT_TOKEN'], 'https://api.slack.com/web', 'Channels, messages, threads, files, reactions, and users.'],
    ['discord', 'Discord', 'communication', 'token', ['DISCORD_BOT_TOKEN'], 'https://discord.com/developers/docs/reference', 'Guild channels, messages, threads, and members.'],
    ['microsoft_teams', 'Microsoft Teams', 'communication', 'oauth', ['MICROSOFT_GRAPH_TOKEN'], 'https://learn.microsoft.com/graph/teams-concept-overview', 'Teams, channels, chat messages, meetings, and recordings.'],
    ['airtable', 'Airtable', 'database', 'token', ['AIRTABLE_TOKEN'], 'https://airtable.com/developers/web/api/introduction', 'Bases, tables, records, fields, and views.'],
    ['postgresql', 'PostgreSQL', 'database', 'connection_string', ['DATABASE_URL'], 'https://www.postgresql.org/docs/current/libpq.html', 'Rows exposed through a configured read-only HTTP query gateway.'],
    ['mysql', 'MySQL', 'database', 'connection_string', ['MYSQL_URL'], 'https://dev.mysql.com/doc/', 'Rows exposed through a configured read-only HTTP query gateway.'],
    ['sqlite', 'SQLite', 'database', 'connection_string', ['SQLITE_PATH'], 'https://sqlite.org/docs.html', 'SQLite records exposed through a configured local HTTP query gateway.'],
    ['mongodb', 'MongoDB', 'database', 'connection_string', ['MONGODB_URI'], 'https://www.mongodb.com/docs/atlas/api/data-api-resources/', 'Documents through the MongoDB Atlas Data API.'],
    ['redis', 'Redis', 'database', 'connection_string', ['REDIS_URL'], 'https://redis.io/docs/latest/develop/connect/clients/rest/', 'Keys and values through a configured read-only REST endpoint.'],
    ['salesforce', 'Salesforce', 'database', 'oauth', ['SALESFORCE_ACCESS_TOKEN'], 'https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/', 'Objects, records, knowledge articles, and activities.'],
    ['hubspot', 'HubSpot', 'database', 'token', ['HUBSPOT_ACCESS_TOKEN'], 'https://developers.hubspot.com/docs/api/overview', 'CRM objects, engagements, tickets, and knowledge content.'],
    ['zendesk', 'Zendesk', 'communication', 'token', ['ZENDESK_TOKEN'], 'https://developer.zendesk.com/api-reference/', 'Tickets, comments, users, organizations, and help-center articles.'],
    ['intercom', 'Intercom', 'communication', 'token', ['INTERCOM_ACCESS_TOKEN'], 'https://developers.intercom.com/docs/references/rest-api/api.intercom.io/', 'Conversations, contacts, companies, tickets, and articles.'],
    ['freshdesk', 'Freshdesk', 'communication', 'api_key', ['FRESHDESK_API_KEY'], 'https://developers.freshdesk.com/api/', 'Tickets, conversations, contacts, companies, and solutions.'],
    ['monday', 'monday.com', 'project', 'api_key', ['MONDAY_API_KEY'], 'https://developer.monday.com/api-reference/docs', 'Boards, groups, items, updates, and workspaces.'],
    ['clickup', 'ClickUp', 'project', 'token', ['CLICKUP_TOKEN'], 'https://developer.clickup.com/reference/', 'Spaces, folders, lists, tasks, comments, and docs.'],
    ['coda', 'Coda', 'knowledge', 'token', ['CODA_API_TOKEN'], 'https://coda.io/developers/apis/v1', 'Docs, pages, tables, rows, and formulas.'],
    ['obsidian_sync', 'Obsidian Sync gateway', 'knowledge', 'token', ['OBSIDIAN_SYNC_TOKEN'], 'https://help.obsidian.md/sync', 'Vault notes exposed through a configured sync or REST gateway.'],
].map(([id, display_name, category, auth, credential_env, documentation_url, description]) => ({
    id: id as string,
    name: display_name as string,
    source_type: id as string,
    status: 'configurable' as const,
    category: category as connector_service_category,
    auth: auth as connector_service_auth,
    credential_env: credential_env as string[],
    documentation_url: documentation_url as string,
    maps: [description as string],
    required_config: ['list_url', 'item_url', 'fields'],
}));
