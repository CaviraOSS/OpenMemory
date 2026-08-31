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
 *  file  : src/connectors/index.ts
 *  usage : implements the LongMemory index component
 */


export * from './adapter_connector.js';
export * from './configurable_connector.js';
export * from './domain_mapper.js';
export * from './mock_connector.js';
export * from './registry.js';
export * from './service_catalog.js';
export * from './plan_helpers.js';
export * from './youtube/youtube_connector.js';
export * from './youtube/youtube_mapper.js';
export * from './github/github_connector.js';
export * from './github/github_mapper.js';
export * from './docs/docs_connector.js';
export * from './docs/docs_mapper.js';
export * from './local/local_file_connector.js';
export * from './local/markdown_connector.js';
export * from './local/markdown_parser.js';
export * from './web/website_connector.js';
export * from './extraction/content_extractor.js';
export * from './extraction/document_transport.js';
export * from './extraction/document_connector.js';
export * from './cloud/cloud_transports.js';
export * from './cloud/cloud_connectors.js';
export { analyze_file, extract_text, is_binary } from './transports/extractors/file_analysis.js';
export { detect_language as detect_file_language, supported_languages as supported_file_languages } from './transports/extractors/language.js';