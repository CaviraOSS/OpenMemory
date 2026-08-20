import type { project_context_result, recall_result } from './types.js';

export const recall_markdown = (result: recall_result): string => [
    `# OpenMemory Recall`,
    '',
    `**Query:** ${result.query}`,
    `**Mode:** ${result.mode}`,
    '',
    ...(result.hits.length ? result.hits.flatMap((hit, index) => [
        `## ${index + 1}. ${hit.status.toUpperCase()} · ${Number(hit.score).toFixed(3)}`,
        '',
        hit.text,
        '',
        `- Memory: \`${hit.id}\``,
        `- Grounded: ${hit.grounded ? 'yes' : 'no'}`,
        `- Source: ${hit.citation ?? 'none'}`,
        '',
    ]) : ['No memories passed the selected recall gates.', '']),
].join('\n');

export const context_markdown = (result: project_context_result): string => [
    '# OpenMemory Project Context',
    '',
    `**Task:** ${result.task}`,
    `**Project:** ${result.project_id}`,
    '',
    result.current_goal ? `## Current Goal\n\n${result.current_goal}\n` : '',
    result.project_summary ? `## Project Summary\n\n${result.project_summary}\n` : '',
    result.hard_constraints.length ? `## Hard Constraints\n\n${result.hard_constraints.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.relevant_architecture.length ? `## Relevant Architecture\n\n${result.relevant_architecture.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.relevant_files.length ? `## Relevant Files\n\n${result.relevant_files.map((value) => `- \`${value.path}\`${value.stale ? ' (stale)' : ''}`).join('\n')}\n` : '',
    result.active_decisions.length ? `## Active Decisions\n\n${result.active_decisions.map((value) => `- ${value.decision}${value.rationale ? `: ${value.rationale}` : ''}`).join('\n')}\n` : '',
    result.open_tasks.length ? `## Open Tasks\n\n${result.open_tasks.map((value) => `- [${value.status}] ${value.task}`).join('\n')}\n` : '',
    result.known_failures.length ? `## Known Failures\n\n${result.known_failures.map((value) => `- ${value}`).join('\n')}\n` : '',
    result.asset_loadout?.selected.length ? `## Equipped Memory Assets\n\n${result.asset_loadout.selected.map((value) => `- **${value.asset.name}** · ${value.asset.type} · ${value.binding?.injection_mode ?? 'reference'} · priority ${value.annotations.priority.toFixed(2)}`).join('\n')}\n` : '',
    result.matched_skills?.length ? `## Matched Skills\n\n${result.matched_skills.map((value) => `### ${value.skill.name} v${value.skill.version}\n\n${value.skill.description}\n\n${value.skill.instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')}${value.skill.validation.length ? `\n\nValidation:\n${value.skill.validation.map((rule) => `- ${rule}`).join('\n')}` : ''}`).join('\n\n')}\n` : '',
    result.suggested_next_steps.length ? `## Suggested Next Steps\n\n${result.suggested_next_steps.map((value, index) => `${index + 1}. ${value}`).join('\n')}\n` : '',
].filter(Boolean).join('\n');
