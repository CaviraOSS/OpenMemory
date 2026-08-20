import { McpServer as mcp_server_sdk } from '@modelcontextprotocol/sdk/server/mcp.js';
import { register_after_coding_prompt } from './prompts/after_coding.js';
import { register_architecture_context_prompt } from './prompts/architecture_context.js';
import { register_before_coding_prompt } from './prompts/before_coding.js';
import { register_debug_session_prompt } from './prompts/debug_session.js';
import { register_project_handoff_prompt } from './prompts/project_handoff.js';
import { register_conflicts_resource } from './resources/conflicts.js';
import { register_decisions_resource } from './resources/decisions.js';
import { register_entity_resource } from './resources/entity.js';
import { register_memory_resource } from './resources/memory.js';
import { register_project_context_resource } from './resources/project_context.js';
import { register_project_summary_resource } from './resources/project_summary.js';
import { register_projects_resource } from './resources/projects.js';
import { register_tasks_resource } from './resources/tasks.js';
import { register_skills_resource } from './resources/skills.js';
import { register_assets_resources } from './resources/assets.js';
import { register_agent_manifest_resource } from './resources/agent_manifest.js';
import { register_world_resource } from './resources/world.js';
import { mcp_runtime, type mcp_runtime_config } from './runtime.js';
import { register_explain_tool } from './tools/explain.js';
import { register_ingest_tool } from './tools/ingest.js';
import { register_project_context_tool } from './tools/project_context.js';
import { register_recall_tool } from './tools/recall.js';
import { register_remember_decision_tool } from './tools/remember_decision.js';
import { register_report_conflicts_tool } from './tools/report_conflicts.js';
import { register_sync_connector_tool } from './tools/sync_connector.js';
import { register_update_task_state_tool } from './tools/update_task_state.js';
import { register_match_skills_tool } from './tools/match_skills.js';
import { register_manage_skill_tool } from './tools/manage_skill.js';
import { register_code_graph_tool } from './tools/code_graph.js';
import { register_asset_catalog_tool } from './tools/asset_catalog.js';
import { register_manage_asset_tool } from './tools/manage_asset.js';

export const mcp_server_name = 'openmemory-hydrograph';
export const mcp_server_version = '0.0.0-phase.27';

export type mcp_server_config = mcp_runtime_config & { runtime?: mcp_runtime };
export type openmemory_mcp = { server: mcp_server_sdk; runtime: mcp_runtime };

const tools = {
    openmemory_project_context: register_project_context_tool,
    openmemory_recall: register_recall_tool,
    openmemory_ingest: register_ingest_tool,
    openmemory_remember_decision: register_remember_decision_tool,
    openmemory_update_task_state: register_update_task_state_tool,
    openmemory_explain: register_explain_tool,
    openmemory_report_conflicts: register_report_conflicts_tool,
    openmemory_sync_connector: register_sync_connector_tool,
    openmemory_match_skills: register_match_skills_tool,
    openmemory_manage_skill: register_manage_skill_tool,
    openmemory_code_graph: register_code_graph_tool,
    openmemory_asset_catalog: register_asset_catalog_tool,
    openmemory_manage_asset: register_manage_asset_tool,
} as const;

export function create_openmemory_mcp(config: mcp_server_config = {}): openmemory_mcp {
    const runtime = config.runtime ?? new mcp_runtime(config);
    const server = new mcp_server_sdk({ name: mcp_server_name, version: mcp_server_version });
    for (const [name, register] of Object.entries(tools)) {
        if (runtime.access.allowed_tools.has(name as keyof typeof tools)) register(server, runtime);
    }
    register_projects_resource(server, runtime);
    register_project_summary_resource(server, runtime);
    register_project_context_resource(server, runtime);
    register_decisions_resource(server, runtime);
    register_tasks_resource(server, runtime);
    register_skills_resource(server, runtime);
    register_assets_resources(server, runtime);
    register_agent_manifest_resource(server, runtime);
    register_conflicts_resource(server, runtime);
    register_entity_resource(server, runtime);
    register_world_resource(server, runtime);
    register_memory_resource(server, runtime);
    register_before_coding_prompt(server);
    register_after_coding_prompt(server);
    register_debug_session_prompt(server);
    register_project_handoff_prompt(server);
    register_architecture_context_prompt(server);
    return { server, runtime };
}

export function create_mcp_server(config: mcp_server_config = {}): mcp_server_sdk {
    return create_openmemory_mcp(config).server;
}