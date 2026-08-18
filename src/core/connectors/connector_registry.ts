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
 *  file  : src/core/connectors/connector_registry.ts
 *  usage : connector registration and loading
 */

import type { Connector, connector_config, connector_factory } from './connector.js';

export class ConnectorRegistry {
    private readonly factories = new Map<string, connector_factory>();

    register(id: string, factory: connector_factory): this {
        if (this.factories.has(id)) throw new Error(`connector already registered: ${id}`);
        this.factories.set(id, factory);
        return this;
    }

    has(id: string): boolean {
        return this.factories.has(id);
    }

    list(): string[] {
        return [...this.factories.keys()].sort();
    }

    load(id: string, config: connector_config = {}): Connector {
        const factory = this.factories.get(id);
        if (!factory) throw new Error(`unknown connector: ${id}`);
        return factory(config);
    }
}