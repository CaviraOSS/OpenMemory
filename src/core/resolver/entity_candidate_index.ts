import { normalize_name } from './entity_score.js';
import type { Entity, EntityMention, EntityType } from '../types/entity.js';

function name_keys(name: string): string[] {
    const normalized = normalize_name(name);
    if (!normalized) return [];
    const keys = new Set(normalized.split(' ').filter(Boolean).map((token) => `token:${token}`));
    const compact = normalized.replaceAll(' ', '');
    for (let index = 0; index < compact.length - 1; index++) keys.add(`bigram:${compact.slice(index, index + 2)}`);
    return [...keys];
}

export class entity_candidate_index {
    private readonly ids_by_key = new Map<string, Set<string>>();
    private readonly keys_by_id = new Map<string, Set<string>>();
    private readonly ids_by_type = new Map<EntityType, Set<string>>();
    private readonly ids_by_metadata = new Map<string, Set<string>>();
    private readonly ids_without_metadata = new Map<string, Set<string>>();

    add_entity(entity: Entity): void {
        this.add_name(entity.id, entity.canonical_name);
        for (const alias of entity.aliases) this.add_name(entity.id, alias);
        let type_ids = this.ids_by_type.get(entity.type);
        if (!type_ids) {
            type_ids = new Set<string>();
            this.ids_by_type.set(entity.type, type_ids);
        }
        type_ids.add(entity.id);
        for (const key of ['domain', 'disambiguator']) {
            const value = entity.metadata[key];
            if (typeof value === 'string') this.metadata_bucket(key, value).add(entity.id);
            else this.missing_metadata_bucket(key).add(entity.id);
        }
    }

    add_name(entity_id: string, name: string): void {
        for (const key of name_keys(name)) {
            let ids = this.ids_by_key.get(key);
            if (!ids) {
                ids = new Set<string>();
                this.ids_by_key.set(key, ids);
            }
            ids.add(entity_id);
            let keys = this.keys_by_id.get(entity_id);
            if (!keys) {
                keys = new Set<string>();
                this.keys_by_id.set(entity_id, keys);
            }
            keys.add(key);
        }
    }

    candidates(input: EntityMention): Set<string> {
        const query_keys = name_keys(input.name);
        const constraints: Set<string>[] = [];
        if (input.type && input.type !== 'unknown') {
            constraints.push(new Set([...(this.ids_by_type.get(input.type) ?? []), ...(this.ids_by_type.get('unknown') ?? [])]));
        }
        for (const key of ['domain', 'disambiguator']) {
            const value = input.metadata?.[key];
            if (typeof value !== 'string') continue;
            constraints.push(new Set([
                ...this.metadata_bucket(key, value),
                ...this.missing_metadata_bucket(key),
            ]));
        }
        if (constraints.length) {
            constraints.sort((left, right) => left.size - right.size);
            const candidates = new Set(constraints[0]);
            for (const constraint of constraints.slice(1)) this.intersect(candidates, constraint);
            for (const id of candidates) {
                const keys = this.keys_by_id.get(id);
                if (!keys || !query_keys.some((key) => keys.has(key))) candidates.delete(id);
            }
            return candidates;
        }
        const candidates = new Set<string>();
        for (const key of query_keys) {
            for (const id of this.ids_by_key.get(key) ?? []) candidates.add(id);
        }
        return candidates;
    }

    clear(): void {
        this.ids_by_key.clear();
        this.keys_by_id.clear();
        this.ids_by_type.clear();
        this.ids_by_metadata.clear();
        this.ids_without_metadata.clear();
    }

    private metadata_bucket(key: string, value: string): Set<string> {
        const bucket_key = `${key}\u0000${value}`;
        let ids = this.ids_by_metadata.get(bucket_key);
        if (!ids) {
            ids = new Set<string>();
            this.ids_by_metadata.set(bucket_key, ids);
        }
        return ids;
    }

    private missing_metadata_bucket(key: string): Set<string> {
        let ids = this.ids_without_metadata.get(key);
        if (!ids) {
            ids = new Set<string>();
            this.ids_without_metadata.set(key, ids);
        }
        return ids;
    }

    private intersect(target: Set<string>, allowed: ReadonlySet<string>): void {
        for (const id of target) if (!allowed.has(id)) target.delete(id);
    }
}