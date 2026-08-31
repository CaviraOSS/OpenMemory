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
 *  file  : src/core/connectors/permission.ts
 *  usage : implements the LongMemory permission component
 */


import type { Contract, SourcePermission } from '../types/contract.js';

export type connector_permission = SourcePermission & {
    inherited: boolean;
    raw: Record<string, unknown>;
};

export const public_permission = (): connector_permission => ({
    scope: 'public', user_ids: [], team_ids: [], project_ids: [], source_id: null, inherited: false, raw: {},
});

export function permission_contract(permission: connector_permission): Partial<Contract> {
    return {
        privacy_level: permission.scope === 'public' ? 'public' : 'private',
        source_permission: {
            scope: permission.scope,
            user_ids: [...permission.user_ids],
            team_ids: [...permission.team_ids],
            project_ids: [...permission.project_ids],
            source_id: permission.source_id,
        },
    };
}