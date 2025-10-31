import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

interface ModelConfig {
    [sector: string]: Record<string, string>
}

let cfg: ModelConfig | null = null

export const loadModels = (): ModelConfig => {
    if (cfg) return cfg

    const p = join(__dirname, '../../../models.yml')
    if (!existsSync(p)) {
        console.warn('⚠️ models.yml not found, using defaults')
        return getDefaults()
    }

    try {
        const yml = readFileSync(p, 'utf-8')
        cfg = parseYaml(yml)
        console.log(`📋 Loaded models.yml (${Object.keys(cfg).length} sectors)`)
        return cfg
    } catch (e) {
        console.error('❌ Failed to parse models.yml:', e)
        return getDefaults()
    }
}

const parseYaml = (yml: string): ModelConfig => {
    const lines = yml.split('\n')
    const obj: ModelConfig = {}
    let currentSector: string | null = null

    for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith('#')) continue

        const indent = line.search(/\S/)
        const [key, ...valParts] = trimmed.split(':')
        const val = valParts.join(':').trim()

        if (indent === 0 && val) {
            // Top-level key with value (shouldn't happen in our format)
            continue
        } else if (indent === 0) {
            // Sector name
            currentSector = key
            obj[currentSector] = {}
        } else if (currentSector && val) {
            // Provider: model mapping
            obj[currentSector][key] = val
        }
    }

    return obj
}

const getDefaults = (): ModelConfig => ({
    episodic: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    semantic: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    procedural: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    emotional: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    reflective: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-large', gemini: 'models/embedding-001', local: 'all-mpnet-base-v2' }
})

export const getModel = (sector: string, provider: string): string => {
    const cfg = loadModels()
    return cfg[sector]?.[provider] || cfg.semantic?.[provider] || 'nomic-embed-text'
}

export const getProviderConfig = (provider: string): any => {
    return {}
}
