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
 *  file  : src/core/types/contract.ts
 *  usage : how a durable fact may be used downstream
 */










export type PrivacyLevel = 'public' | 'private' | 'sensitive' | 'secret';

export type AccessScope = 'public' | 'private' | 'project' | 'team' | 'user_only' | 'source_restricted';

export type SourcePermission = {
    scope: AccessScope;
    user_ids: string[];
    team_ids: string[];
    project_ids: string[];
    source_id: string | null;
};

export type Contract = {
    use_for_reasoning: boolean;
    use_for_personalization: boolean;
    use_for_prediction: boolean;
    use_for_emotional_context: boolean;
    use_for_associative_recall: boolean;
    requires_grounding: boolean;
    expires_if_unconfirmed: boolean;
    privacy_level: PrivacyLevel;
    
    max_valid_duration: number | null;
    
    source_required: boolean;
    source_permission: SourcePermission | null;
    preserve_exact_language: boolean;
    translation_allowed: boolean;
    transliteration_allowed: boolean;
};


export type MemoryContract = Contract;

export function default_contract(): Contract {
    return {
        use_for_reasoning: true,
        use_for_personalization: false,
        use_for_prediction: false,
        use_for_emotional_context: false,
        use_for_associative_recall: true,
        requires_grounding: false,
        expires_if_unconfirmed: false,
        privacy_level: 'private',
        max_valid_duration: null,
        source_required: false,
        source_permission: null,
        preserve_exact_language: false,
        translation_allowed: true,
        transliteration_allowed: true,
    };
}

