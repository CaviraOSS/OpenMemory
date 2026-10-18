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
 *  file  : src/core/engine/claim_extractor.ts
 *  usage : implements the LongMemory claim extractor component
 */


export type ClaimKind = 'preference' | 'fact' | 'action' | 'procedure' | 'reflection';

export type ExtractedClaim = {
    kind: ClaimKind;
    statement: string;
    subject: string;
    predicate: string;
    object: string;
    topic: string;
};

const preference = /\b(?:I|we)\s+(?:(?:now|also|really|especially|generally)\s+)*(?:prefer|like|love|dislike|hate)\s+(.+?)(?:\s+instead of\s+(.+))?$/i;
const moved_location = /\b(?:my\s+(?:friend|colleague|coworker|partner)\s+)?([A-Z][\p{L}'-]+)\b[^.!?]{0,80}?\bmov(?:ed|ing)\b[^.!?]{0,40}?\b(?:back\s+)?to\s+(?:the\s+)?(.+)$/iu;
const location = /\b(.+?)\s+(?:is|are|was|were)\s+(?:currently\s+|now\s+)?(?:in|at|on)\s+(.+)$/i;
const copula = /\b(.+?)\s+(?:is|are|was|were)\s+(.+)$/i;
const first_person = /^(?:(?:hi|hello|hey)[,\s]+)?(?:i\s+am|i['\u2019]m|my\s+name\s+is)\s+(.+)$/i;
const contact = /^(?:please\s+)?(?:ping|contact|message|reach)\s+me\s+(?:on|via|by)\s+(.+?)(?:\s+(?:instead of|rather than)\s+.+)?$/i;
const mode_change = /^(?:(?:actually|please|now)[,\s]+)*(?:switch|change)\s+me\s+to\s+(.+\b(?:mode|theme))$/i;

function preference_topic(object: string): string {
    const topic = object.match(/\bas my\s+([a-z0-9_-]+)/i);
    const mode = object.match(/\b(mode|theme)\b/i);
    return topic ? `preference:${clean(topic[1])}` : mode ? `preference:${clean(mode[1])}` : 'preference:general';
}

function clean(value: string): string {
    return value.trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').toLowerCase();
}

const table_cells = (line: string): string[] => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim());
const separator_cell = (cell: string): boolean => /^:?-{3,}:?$/.test(cell);

function extract_table_claims(text: string): ExtractedClaim[] {
    const lines = text.split(/\r?\n/);
    const claims: ExtractedClaim[] = [];
    for (let index = 1; index < lines.length; index++) {
        if (!lines[index].trim().startsWith('|')) continue;
        const separators = table_cells(lines[index]);
        if (!separators.length || !separators.every(separator_cell)) continue;
        const headers = table_cells(lines[index - 1]);
        for (let row_index = index + 1; row_index < lines.length && lines[row_index].trim().startsWith('|'); row_index++) {
            const row = table_cells(lines[row_index]);
            const subject = clean(row[0] || `row ${row_index - index}`);
            for (let column = 1; column < Math.min(headers.length, row.length); column++) {
                if (!headers[column] || !row[column]) continue;
                const heading = clean(headers[column]);
                const object = clean(row[column]);
                claims.push({
                    kind: 'fact',
                    statement: `${subject}: ${heading} = ${object}`,
                    subject,
                    predicate: `table:${heading}`,
                    object,
                    topic: `table:${subject}:${heading}`,
                });
            }
        }
    }
    return claims;
}

export function extract_claims(text: string): ExtractedClaim[] {
    const table_claims = extract_table_claims(text);
    const source_role = text.match(/^\s*(user|assistant|system|tool|function):\s*/i)?.[1].toLowerCase() ?? 'user';
    const prose = text.split(/\r?\n/).filter((line) => !line.trim().startsWith('|')).join('\n');
    const protected_text = prose.replace(/[\p{L}\p{N}.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu, (email) => email.replaceAll('.', '<period>').replaceAll('!', '<exclaim>').replaceAll('?', '<question>'))
        .replace(/(?<=\d)\.(?=\d)/g, '<period>').replace(/\b(Dr|Mr|Mrs|Ms|Prof|[A-Z])\./g, '$1<period>');
    const statements = protected_text.split(/[.!?]+/)
        .flatMap((item) => item.split(/,\s*(?=(?:please\s+)?(?:ping|contact|message|reach)\s+me\b)/i))
        .map((item) => item.replaceAll('<period>', '.').replaceAll('<exclaim>', '!').replaceAll('<question>', '?').replace(/^\s*(?:user|assistant|system|tool|function):\s*/i, '').trim()).filter(Boolean);
    const prose_claims = statements.map((statement): ExtractedClaim => {
        const pref = statement.match(preference) ?? statement.match(mode_change);
        if (pref) {
            const object = clean(pref[1]);
            return {
                kind: 'preference', statement, subject: source_role, predicate: 'prefers', object,
                topic: preference_topic(object),
            };
        }
        const channel = statement.match(contact);
        if (channel) {
            return {
                kind: 'fact', statement, subject: source_role, predicate: 'contact_via', object: clean(channel[1]),
                topic: `contact_via:${source_role}`,
            };
        }
        const profile = statement.match(first_person);
        if (profile) {
            const named = /\bname\s+is\b/i.test(statement)
                || /^(?:hi|hello|hey)[,\s]+/i.test(statement) && /^[\p{Lu}][\p{L}'-]+(?:\s+[\p{Lu}][\p{L}'-]+){0,3}$/u.test(profile[1]);
            const place = profile[1].match(/^(?:currently\s+|now\s+)?(?:in|at|on)\s+(.+)$/i);
            const role = /^(?:a\s+|an\s+|the\s+)?(?:[\p{L}-]+\s+){0,4}(?:lead|engineer|developer|designer|manager|researcher|teacher|doctor|nurse|student|director)\b/iu.test(profile[1]);
            const predicate = named ? 'name' : place ? 'located_in' : role ? 'role' : 'is';
            const object = clean(place && !named ? place[1] : profile[1]);
            return {
                kind: 'fact', statement, subject: source_role, predicate, object,
                topic: `${predicate}:${source_role}${predicate === 'is' ? `:${object}` : ''}`,
            };
        }
        const moved = statement.match(moved_location);
        if (moved) {
            return {
                kind: 'fact', statement, subject: clean(moved[1]), predicate: 'located_in', object: clean(moved[2]),
                topic: `located_in:${clean(moved[1])}`,
            };
        }
        const place = statement.match(location);
        if (place) {
            return {
                kind: 'fact', statement, subject: clean(place[1]), predicate: 'located_in', object: clean(place[2]),
                topic: `located_in:${clean(place[1])}`,
            };
        }
        const fact = statement.match(copula);
        if (fact) {
            return {
                kind: 'fact', statement, subject: clean(fact[1]), predicate: 'is', object: clean(fact[2]),
                topic: `is:${clean(fact[1])}`,
            };
        }
        const lower = statement.toLowerCase();
        const kind: ClaimKind = /\b(first|then|step|procedure|workflow|to fix)\b/.test(lower)
            ? 'procedure'
            : /\b(realized|learned|noticed|think|believe)\b/.test(lower)
                ? 'reflection'
                : 'action';
        return { kind, statement, subject: source_role, predicate: kind, object: clean(statement), topic: `${kind}:${source_role}:${clean(statement)}` };
    });
    return [...table_claims, ...prose_claims];
}

export function claims_conflict(left: ExtractedClaim, right: ExtractedClaim): boolean {
    return left.topic === right.topic && left.object !== right.object;
}

export function render_claim(claim: ExtractedClaim): string {
    return claim.predicate.startsWith('table:')
        ? `${claim.subject}: ${claim.predicate.slice(6)} = ${claim.object}`
        : `${claim.subject} ${claim.predicate} ${claim.object}`;
}

export function summarize_claims(
    claims: readonly ExtractedClaim[],
    limit = 32,
    context?: { speaker?: string; observed_at?: number },
): string {
    const statements = [...new Set(claims.map((claim) => context ? claim.statement.trim() || render_claim(claim) : render_claim(claim)))].slice(0, limit);
    if (!statements.length) return '';
    const labels = context ? [
        context.observed_at !== undefined && Number.isFinite(context.observed_at) ? new Date(context.observed_at).toISOString() : '',
        context.speaker?.trim() ?? '',
    ].filter(Boolean) : [];
    return `${labels.length ? `[${labels.join(' ')}] ` : ''}${statements.join('; ')}`;
}