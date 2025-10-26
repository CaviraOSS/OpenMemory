const SYNONYM_GROUPS: string[][] = [
    ['prefer', 'prefer', 'like', 'love', 'enjoy', 'favor', 'favour', 'preference'],
    ['theme', 'theme', 'mode', 'style', 'layout', 'appearance', 'skin', 'palette'],
    ['meeting', 'meeting', 'meet', 'session', 'call', 'sync', 'standup', 'conference', 'appointment', 'gathering'],
    ['dark', 'dark', 'night', 'nighttime', 'black'],
    ['light', 'light', 'bright', 'day', 'daytime'],
    ['user', 'user', 'person', 'people', 'customer', 'client', 'participant', 'individual'],
    ['task', 'task', 'todo', 'job', 'assignment', 'item'],
    ['note', 'note', 'memo', 'reminder', 'record'],
    ['time', 'time', 'schedule', 'when', 'date'],
    ['project', 'project', 'initiative', 'plan'],
    ['issue', 'issue', 'problem', 'bug', 'error'],
    ['document', 'document', 'doc', 'file', 'record'],
    ['question', 'question', 'query', 'ask', 'request']
]

const CANONICAL_MAP = new Map<string, string>()
const SYNONYM_LOOKUP = new Map<string, Set<string>>()

for (const group of SYNONYM_GROUPS) {
    const canonical = group[0]
    const normalizedCanonical = canonical.toLowerCase()
    for (const word of group) {
        const normalized = word.toLowerCase()
        CANONICAL_MAP.set(normalized, normalizedCanonical)
        const set = SYNONYM_LOOKUP.get(normalizedCanonical) ?? new Set<string>()
        for (const synonym of group) {
            set.add(synonym.toLowerCase())
        }
        SYNONYM_LOOKUP.set(normalizedCanonical, set)
    }
}

const STEM_RULES: Array<[RegExp, string]> = [
    [/ies$/, 'y'],
    [/ing$/, ''],
    [/ers?$/, 'er'],
    [/ed$/, ''],
    [/s$/, '']
]

const TOKEN_RE = /[a-z0-9]+/gi

export function tokenize(text: string): string[] {
    const tokens: string[] = []
    let match: RegExpExecArray | null
    while ((match = TOKEN_RE.exec(text)) !== null) {
        tokens.push(match[0].toLowerCase())
    }
    return tokens
}

function applyStemming(token: string): string {
    if (token.length <= 3) return token
    for (const [pattern, replacement] of STEM_RULES) {
        if (pattern.test(token)) {
            const stemmed = token.replace(pattern, replacement)
            if (stemmed.length >= 3) return stemmed
        }
    }
    return token
}

export function canonicalizeToken(rawToken: string): string {
    if (!rawToken) return ''
    const lowered = rawToken.toLowerCase()
    if (CANONICAL_MAP.has(lowered)) {
        return CANONICAL_MAP.get(lowered)!
    }
    const stemmed = applyStemming(lowered)
    if (CANONICAL_MAP.has(stemmed)) {
        return CANONICAL_MAP.get(stemmed)!
    }
    return stemmed
}

export function canonicalTokensFromText(text: string): string[] {
    const tokens = tokenize(text)
    const canonical: string[] = []
    for (const token of tokens) {
        const c = canonicalizeToken(token)
        if (c && c.length > 1) {
            canonical.push(c)
        }
    }
    return canonical
}

export function synonymsFor(token: string): Set<string> {
    const canonical = canonicalizeToken(token)
    const synonyms = SYNONYM_LOOKUP.get(canonical)
    if (!synonyms) {
        return new Set([canonical])
    }
    return new Set(Array.from(synonyms).map(s => canonicalizeToken(s)))
}

export function buildSearchDocument(text: string): string {
    const canonicalTokens = canonicalTokensFromText(text)
    const expansion = new Set<string>()
    for (const token of canonicalTokens) {
        const syns = SYNONYM_LOOKUP.get(token)
        if (syns) {
            for (const s of syns) {
                expansion.add(s)
            }
        }
    }
    const canonicalSection = canonicalTokens.join(' ')
    const expansionSection = Array.from(expansion).join(' ')
    return [text, canonicalSection, expansionSection].filter(Boolean).join(' ')
}

export function buildFtsQuery(text: string): string {
    const canonicalTokens = canonicalTokensFromText(text)
    if (!canonicalTokens.length) return ''
    const unique = Array.from(new Set(canonicalTokens.filter(t => t.length > 1)))
    return unique.map(token => `"${token}"`).join(' OR ')
}

export function canonicalTokenSet(text: string): Set<string> {
    return new Set(canonicalTokensFromText(text))
}

export function addSynonymTokens(tokens: Iterable<string>): Set<string> {
    const result = new Set<string>()
    for (const token of tokens) {
        result.add(token)
        const syns = SYNONYM_LOOKUP.get(token)
        if (syns) {
            for (const s of syns) {
                result.add(canonicalizeToken(s))
            }
        }
    }
    return result
}
