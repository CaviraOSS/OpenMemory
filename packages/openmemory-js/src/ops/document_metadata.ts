const DATE_PATTERNS = /([A-Za-z]+ \d{1,2}, \d{4}|\d{4}-\d{2}-\d{2})/i;

function parseDateToIso(raw: string): string | undefined {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) return undefined;
    return parsed.toISOString();
}

function inferDocType(text: string): string | undefined {
    const sample = text.slice(0, 2000).toLowerCase();
    if (sample.includes("non-disclosure agreement") || sample.includes(" nda ")) return "agreement";
    if (sample.includes("agreement")) return "agreement";
    if (sample.includes("contract")) return "contract";
    if (sample.includes("policy")) return "policy";
    if (sample.includes("memorandum") || sample.includes(" memo ")) return "memo";
    if (sample.includes("report")) return "report";
    return undefined;
}

export function enrichDocumentMetadata(
    text: string,
    metadata?: Record<string, unknown>,
): Record<string, unknown> {
    const out = { ...(metadata || {}) };
    const sample = text.slice(0, 4000);

    if (!out.doc_type) {
        const inferred = inferDocType(sample);
        if (inferred) out.doc_type = inferred;
    }

    if (!out.parties) {
        const between = sample.match(/between\s+(.{2,120}?)\s+and\s+(.{2,120}?)(?:[\n,.;]|$)/i);
        if (between) out.parties = [between[1].trim(), between[2].trim()];
    }

    if (!out.effective_date) {
        const m = sample.match(new RegExp(`effective(?:\\s+date)?(?:\\s+is|\\s+of|:)?\\s+${DATE_PATTERNS.source}`, "i"));
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.effective_date = iso;
    }

    if (!out.expiration_date) {
        const m = sample.match(new RegExp(`(?:expiration|expiry|expires)(?:\\s+date|\\s+on|:)?\\s+${DATE_PATTERNS.source}`, "i"));
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.expiration_date = iso;
    }

    if (!out.signing_date) {
        const m = sample.match(new RegExp(`(?:signed\\s+on|dated)(?:\\s+as\\s+of|:)?\\s+${DATE_PATTERNS.source}`, "i"));
        const iso = parseDateToIso(m?.[1] || "");
        if (iso) out.signing_date = iso;
    }

    return out;
}
