const SYN = [
    ['prefer', 'like', 'love', 'enjoy', 'favor'],
    ['theme', 'mode', 'style', 'layout'],
    ['meeting', 'meet', 'session', 'call', 'sync'],
    ['dark', 'night', 'black'],
    ['light', 'bright', 'day'],
    ['user', 'person', 'people', 'customer'],
    ['task', 'todo', 'job'],
    ['note', 'memo', 'reminder'],
    ['time', 'schedule', 'when', 'date'],
    ['project', 'initiative', 'plan'],
    ['issue', 'problem', 'bug'],
    ['document', 'doc', 'file'],
    ['question', 'query', 'ask']
]

const CAN = new Map<string, string>()
const LOOK = new Map<string, Set<string>>()

for (const g of SYN) {
    const c = g[0]
    for (const w of g) {
        CAN.set(w, c)
        const s = LOOK.get(c) ?? new Set<string>()
        g.forEach(x => s.add(x))
        LOOK.set(c, s)
    }
}

const STEM: Array<[RegExp, string]> = [[/ies$/, 'y'], [/ing$/, ''], [/ers?$/, 'er'], [/ed$/, ''], [/s$/, '']]
const TOK = /[a-z0-9]+/gi

export const tokenize = (t: string) => {
    const r: string[] = []
    let m: RegExpExecArray | null
    while ((m = TOK.exec(t))) r.push(m[0].toLowerCase())
    return r
}

const stem = (t: string) => {
    if (t.length <= 3) return t
    for (const [p, r] of STEM) {
        if (p.test(t)) {
            const s = t.replace(p, r)
            if (s.length >= 3) return s
        }
    }
    return t
}

export const canonicalizeToken = (t: string) => {
    if (!t) return ''
    const l = t.toLowerCase()
    if (CAN.has(l)) return CAN.get(l)!
    const s = stem(l)
    return CAN.get(s) || s
}

export const canonicalTokensFromText = (t: string) => {
    const r: string[] = []
    for (const tok of tokenize(t)) {
        const c = canonicalizeToken(tok)
        if (c && c.length > 1) r.push(c)
    }
    return r
}

export const synonymsFor = (t: string) => {
    const c = canonicalizeToken(t)
    return LOOK.get(c) || new Set([c])
}

export const buildSearchDocument = (t: string) => {
    const c = canonicalTokensFromText(t)
    const e = new Set<string>()
    for (const tok of c) {
        const s = LOOK.get(tok)
        if (s) s.forEach(x => e.add(x))
    }
    return [t, c.join(' '), Array.from(e).join(' ')].filter(Boolean).join(' ')
}

export const buildFtsQuery = (t: string) => {
    const c = canonicalTokensFromText(t)
    if (!c.length) return ''
    const u = Array.from(new Set(c.filter(x => x.length > 1)))
    return u.map(x => `"${x}"`).join(' OR ')
}

export const canonicalTokenSet = (t: string) => new Set(canonicalTokensFromText(t))

export const addSynonymTokens = (toks: Iterable<string>) => {
    const r = new Set<string>()
    for (const t of toks) {
        r.add(t)
        const s = LOOK.get(t)
        if (s) s.forEach(x => r.add(canonicalizeToken(x)))
    }
    return r
}
