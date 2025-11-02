import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
interface model_cfg { [sector: string]: Record<string, string> }
let cfg: model_cfg | null = null

export const load_models = (): model_cfg => {
    if (cfg) return cfg
    const p = join(__dirname, '../../../models.yml')
    if (!existsSync(p)) {
        console.warn('⚠️ models.yml not found, using defaults')
        return get_defaults()
    }
    try {
        const yml = readFileSync(p, 'utf-8')
        cfg = parse_yaml(yml)
        console.log(`📋 loaded models.yml (${Object.keys(cfg).length} sectors)`)
        return cfg
    } catch (e) {
        console.error('❌ failed to parse models.yml:', e)
        return get_defaults()
    }
}

const parse_yaml = (yml: string): model_cfg => {
    const lines = yml.split('\n')
    const obj: model_cfg = {}
    let cur_sec: string | null = null
    for (const line of lines) {
        const trim = line.trim()
        if (!trim || trim.startsWith('#')) continue
        const indent = line.search(/\S/)
        const [key, ...val_parts] = trim.split(':')
        const val = val_parts.join(':').trim()
        if (indent === 0 && val) {
            continue
        } else if (indent === 0) {
            cur_sec = key
            obj[cur_sec] = {}
        } else if (cur_sec && val) {
            obj[cur_sec][key] = val
        }
    }
    return obj
}

const get_defaults = (): model_cfg => ({
    episodic: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    semantic: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    procedural: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    emotional: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-small', gemini: 'models/embedding-001', local: 'all-MiniLM-L6-v2' },
    reflective: { ollama: 'nomic-embed-text', openai: 'text-embedding-3-large', gemini: 'models/embedding-001', local: 'all-mpnet-base-v2' }
})

export const get_model = (sector: string, provider: string): string => {
    const cfg = load_models()
    return cfg[sector]?.[provider] || cfg.semantic?.[provider] || 'nomic-embed-text'
}

export const get_provider_config = (provider: string): any => {
    return {}
}
