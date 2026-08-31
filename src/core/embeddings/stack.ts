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
 *  file  : src/core/embeddings/stack.ts
 *  usage : implements the LongMemory stack component
 */


import type { configured_embedding_provider, embedding_context, embedding_provider_config, embedding_provider_dependencies } from './types.js';
import { create_named_embedding_provider, synthetic_embedding_provider } from './providers.js';
import { normalize_embedding_vector } from './utility.js';

export class fallback_embedding_provider implements configured_embedding_provider {
    readonly name: string;
    readonly dimension: number;
    constructor(private readonly providers: configured_embedding_provider[], private readonly logger: (message: string) => void = () => {}) {
        if (!providers.length) throw new Error('embedding fallback stack requires at least one provider');
        this.name = providers.map((provider) => provider.name).join(' -> ');
        this.dimension = providers[0].dimension;
    }
    async embed(text: string, context?: embedding_context): Promise<number[]> {
        const failures: string[] = [];
        for (const provider of this.providers) {
            try {
                const vector = await provider.embed(text, context);
                if (failures.length) this.logger(`embedding fallback selected ${provider.name} after ${failures.join('; ')}`);
                return normalize_embedding_vector(vector, this.dimension);
            } catch (error) {
                failures.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        throw new Error(`all embedding providers failed: ${failures.join('; ')}`);
    }
    async embed_many(texts: string[], context?: embedding_context): Promise<number[][]> {
        const failures: string[] = [];
        for (const provider of this.providers) {
            try {
                const vectors = provider.embed_many
                    ? await provider.embed_many(texts, context)
                    : await Promise.all(texts.map((text) => provider.embed(text, context)));
                if (failures.length) this.logger(`embedding fallback selected ${provider.name} after ${failures.join('; ')}`);
                return vectors.map((vector) => normalize_embedding_vector(vector, this.dimension));
            } catch (error) {
                failures.push(`${provider.name}: ${error instanceof Error ? error.message : String(error)}`);
            }
        }
        throw new Error(`all embedding providers failed: ${failures.join('; ')}`);
    }
}

export class smart_embedding_provider implements configured_embedding_provider {
    readonly name: string;
    readonly dimension: number;
    private readonly synthetic: synthetic_embedding_provider;
    constructor(private readonly semantic: configured_embedding_provider) {
        this.dimension = semantic.dimension;
        this.synthetic = new synthetic_embedding_provider(this.dimension);
        this.name = `smart(${semantic.name})`;
    }
    async embed(text: string, context?: embedding_context): Promise<number[]> {
        const [synthetic, semantic] = await Promise.all([this.synthetic.embed(text, context), this.semantic.embed(text, context)]);
        return normalize_embedding_vector(synthetic.map((value, index) => value * 0.35 + semantic[index] * 0.65), this.dimension);
    }
    async embed_many(texts: string[], context?: embedding_context): Promise<number[][]> {
        const [synthetic, semantic] = await Promise.all([
            this.synthetic.embed_many(texts, context),
            this.semantic.embed_many ? this.semantic.embed_many(texts, context) : Promise.all(texts.map((text) => this.semantic.embed(text, context))),
        ]);
        return semantic.map((vector, row) => normalize_embedding_vector(vector.map((value, index) => synthetic[row][index] * 0.35 + value * 0.65), this.dimension));
    }
}

export function create_embedding_stack(config: embedding_provider_config, dependencies: embedding_provider_dependencies = {}): configured_embedding_provider {
    const logger = dependencies.logger ?? (() => {});
    if (config.tier === 'fast' || config.tier === 'hybrid') return new synthetic_embedding_provider(config.dimension);
    const names = [...new Set([config.provider, ...config.fallback, 'synthetic' as const])];
    const semantic = new fallback_embedding_provider(names.map((name) => create_named_embedding_provider(name, config, dependencies)), logger);
    return config.tier === 'smart' ? new smart_embedding_provider(semantic) : semantic;
}