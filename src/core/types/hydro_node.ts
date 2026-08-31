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
 *  file  : src/core/types/hydro_node.ts
 *  usage : implements the LongMemory hydro node component
 */


import type { Contract } from './contract.js';
import type { Facets } from './facets.js';
import type { NodeState } from './node_state.js';
import type { Provenance } from './provenance.js';
import type { code_switch_segment, language_code } from '../i18n/language_detection.js';
import type { script_name, text_direction } from '../i18n/script_detection.js';


export type Zone = 'endocortex' | 'exocortex';

export type NodeClaim = {
    kind: 'preference' | 'fact' | 'action' | 'procedure' | 'reflection';
    statement: string;
    subject: string;
    predicate: string;
    object: string;
    topic: string;
};

export type NodeContent = {
    
    raw: string;
    
    canonical: string;
    
    summary: string;
    claims?: NodeClaim[];
    language?: language_code;
    script?: script_name;
    direction?: text_direction;
    original_text?: string;
    canonical_text?: string;
    translated_text?: string | null;
    transliteration?: string | null;
    locale?: string | null;
    code_switch_segments?: code_switch_segment[];
    language_confidence?: number;
    translation_provenance?: {
        provider: string;
        target_language: language_code;
        confidence: number;
        derived_at: number;
        source_text_hash: string;
    } | null;
};


export type NodeWorld = {
    world_id: string;
    parent_world_id: string | null;
    zone: Zone;
    scope_path: string[];
};


export type NodeTemporal = {
    
    valid_from: number;
    
    valid_to: number | null;
    
    observed_at: number;
    
    recorded_at: number;
    
    superseded_at: number | null;
};

export type NodeGrounding = {
    
    worlddb_ref: string | null;
    source_ids: string[];
    
    grounding_score: number;
};

export type NodeVectors = {
    semantic: number[] | null;
    type_vector: number[] | null;
    world_vector: number[] | null;
};

export type HydroNode = {
    id: string;
    content_hash: string;
    content: NodeContent;
    facets: Facets;
    world: NodeWorld;
    temporal: NodeTemporal;
    contract: Contract;
    grounding: NodeGrounding;
    state: NodeState;
    vectors: NodeVectors;
    provenance: Provenance;
    metadata: Record<string, unknown>;
};


export type HydroNodeInput = Omit<HydroNode, 'id' | 'content_hash' | 'metadata'> & {
    id?: string;
    metadata?: Record<string, unknown>;
};
