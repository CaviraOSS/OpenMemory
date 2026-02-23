const DATE_PATTERNS = /([A-Za-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/i;
const DOC_TYPE_SAMPLE_SIZE = 2000;
const METADATA_SAMPLE_SIZE = 4000;
const MAX_PARTY_NAME_LENGTH = 100;
const PARTY_PATTERN = new RegExp(
    `between\\s+([A-Z][A-Za-z0-9\\s&.,'-]{1,${MAX_PARTY_NAME_LENGTH}}?)\\s+and\\s+([A-Z][A-Za-z0-9\\s&.,'-]{1,${MAX_PARTY_NAME_LENGTH}}?)(?:[\\n,.;]|$)`,
);
const EFFECTIVE_DATE_PATTERN = new RegExp(`effective(?:\\s+date)?(?:\\s+is|\\s+of|:)?\\s+${DATE_PATTERNS.source}`, "i");
const EXPIRATION_DATE_PATTERN = new RegExp(`(?:expiration|expiry|expires)(?:\\s+date|\\s+on|:)?\\s+${DATE_PATTERNS.source}`, "i");
const SIGNING_DATE_PATTERN = new RegExp(`(?:signed\\s+on|dated)(?:\\s+as\\s+of|:)?\\s+${DATE_PATTERNS.source}`, "i");

function parseDateToIso(raw: string): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
}

function inferDocType(text: string): string | undefined {
    const sample = text.slice(0, DOC_TYPE_SAMPLE_SIZE).toLowerCase();
    if (sample.includes("non-disclosure agreement") || sample.includes(" nda ")) return "agreement";
    if (sample.includes("agreement")) return "agreement";
    if (sample.includes("contract")) return "contract";
    if (sample.includes("policy")) return "policy";
    if (sample.includes("memorandum") || sample.includes(" memo ")) return "memo";
    if (sample.includes("report")) return "report";
    return undefined;
}

export function parse_frontmatter(content: string): { meta: Record<string, unknown>; body: string } {
    const fm_re = /^---\n([\s\S]*?)\n---\n/;
    const match = content.match(fm_re);
    if (!match) return { meta: {}, body: content };
    const body = content.slice(match[0].length);
    const meta: Record<string, unknown> = {};
    for (const line of match[1].split('\n')) {
        const idx = line.indexOf(':');
        if (idx > 0) {
            meta[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
    }
    return { meta, body };
}

export function split_by_sections(content: string): Array<{ heading: string; body: string }> {
    const sections: Array<{ heading: string; body: string }> = [];
    const heading_re = /^#{1,3} (.+)$/gm;
    let last_idx = 0;
    let last_heading = '__root__';
    let match: RegExpExecArray | null;
    while ((match = heading_re.exec(content)) !== null) {
        if (match.index > last_idx) {
            sections.push({ heading: last_heading, body: content.slice(last_idx, match.index).trim() });
        }
        last_heading = match[1];
        last_idx = match.index + match[0].length + 1;
    }
    if (last_idx < content.length) {
        sections.push({ heading: last_heading, body: content.slice(last_idx).trim() });
    }
    return sections.filter(s => s.body.length > 0);
}

export function enrichDocumentMetadata(
    text: string,
    metadata?: Record<string, unknown>,
): Record<string, unknown> {
    const out = { ...(metadata || {}) };
    const sample = text.slice(0, METADATA_SAMPLE_SIZE);

    if (!out.doc_type) {
        const inferred = inferDocType(sample);
        if (inferred) out.doc_type = inferred;
    }

    if (!out.parties) {
        const between = sample.match(PARTY_PATTERN);
        if (between) out.parties = [between[1].trim(), between[2].trim()];
    }

    if (!out.effective_date) {
        const m = sample.match(EFFECTIVE_DATE_PATTERN);
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.effective_date = iso;
    }

    if (!out.expiration_date) {
        const m = sample.match(EXPIRATION_DATE_PATTERN);
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.expiration_date = iso;
    }

    if (!out.signing_date) {
        const m = sample.match(SIGNING_DATE_PATTERN);
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.signing_date = iso;
    }

    return out;
}
