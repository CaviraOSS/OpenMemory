/**
 * Redline/Change Classification System (D4)
 *
 * Provides word-level diff and classification of changes:
 * - Financial changes (amounts, percentages, currencies)
 * - Date changes (dates, time periods, deadlines)
 * - Party changes (names, entities, roles)
 * - Legal term changes (defined terms, obligations)
 * - General text changes
 */

export type ChangeCategory =
    | "financial"
    | "date"
    | "party"
    | "legal_term"
    | "general";

export interface WordChange {
    type: "added" | "removed" | "unchanged";
    text: string;
    category: ChangeCategory;
    position: number;
}

export interface ClassifiedChange {
    category: ChangeCategory;
    added: string[];
    removed: string[];
    context: string;
}

export interface RedlineResult {
    word_changes: WordChange[];
    classified_changes: Record<ChangeCategory, ClassifiedChange>;
    summary: {
        total_changes: number;
        by_category: Record<ChangeCategory, number>;
        severity: "minor" | "moderate" | "major" | "critical";
    };
    redline_html: string;
}

// Pattern matchers for classification
const PATTERNS: Record<ChangeCategory, RegExp[]> = {
    financial: [
        /\$[\d,]+(?:\.\d{2})?/g,                    // Dollar amounts
        /£[\d,]+(?:\.\d{2})?/g,                     // Pound amounts
        /€[\d,]+(?:\.\d{2})?/g,                     // Euro amounts
        /\d+(?:\.\d+)?%/g,                          // Percentages
        /\b(?:USD|GBP|EUR|AUD)\s*[\d,]+/gi,        // Currency codes with amounts
        /\b(?:million|billion|thousand)\b/gi,       // Large number words
        /\b(?:fee|payment|cost|price|amount|sum|total|value)\b/gi,
    ],
    date: [
        /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/g,  // Numeric dates
        /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\b/gi, // Month names
        /\b\d{1,2}(?:st|nd|rd|th)?\b/g,            // Day numbers (1, 1st, 2nd, etc.)
        /\b(?:19|20)\d{2}\b/g,                     // Years (1900s-2000s)
        /\b(?:day|week|month|year|quarter)s?\b/gi,
        /\b(?:deadline|due date|effective date|termination date|expiry|expiration)\b/gi,
        /\b\d{4}-\d{2}-\d{2}\b/g,                   // ISO dates
    ],
    party: [
        /\b(?:Party|Parties|Company|Corporation|Inc\.|Ltd\.|LLC|LLP|Pty)\b/gi,
        /\b(?:Seller|Buyer|Vendor|Purchaser|Lessor|Lessee|Landlord|Tenant)\b/gi,
        /\b(?:Employer|Employee|Contractor|Client|Customer|Supplier)\b/gi,
        /\b(?:Plaintiff|Defendant|Claimant|Respondent|Applicant)\b/gi,
        /\b[A-Z][a-z]+\s+(?:Inc\.|Ltd\.|LLC|LLP|Corp\.?|Pty)\b/g, // Company names
    ],
    legal_term: [
        /\b(?:shall|must|will|may|should)\b/gi,     // Obligation words
        /\b(?:hereby|herein|hereof|thereof|whereas|notwithstanding)\b/gi,
        /\b(?:indemnify|warrant|represent|covenant|undertake)\b/gi,
        /\b(?:termination|breach|default|remedy|liability|damages)\b/gi,
        /\b(?:confidential|proprietary|intellectual property|trade secret)\b/gi,
        /\b(?:force majeure|material adverse|good faith|best efforts)\b/gi,
        /"[A-Z][^"]+"/g,                            // Defined terms in quotes
    ],
    general: [], // Fallback - no specific patterns
};

/**
 * Tokenize text into words while preserving punctuation context
 */
function tokenize(text: string): string[] {
    return text.split(/(\s+)/).filter(t => t.length > 0);
}

/**
 * Classify a piece of text into a category
 */
function classify_text(text: string): ChangeCategory {
    for (const [category, patterns] of Object.entries(PATTERNS) as [ChangeCategory, RegExp[]][]) {
        if (category === "general") continue;
        for (const pattern of patterns) {
            // Reset regex state
            pattern.lastIndex = 0;
            if (pattern.test(text)) {
                return category;
            }
        }
    }
    return "general";
}

/**
 * Compute word-level diff between two texts
 */
export function compute_word_diff(old_text: string, new_text: string): WordChange[] {
    const old_words = tokenize(old_text);
    const new_words = tokenize(new_text);

    // Use a simple LCS-based diff algorithm
    const changes: WordChange[] = [];

    // Build a map of old words for quick lookup
    const old_word_positions = new Map<string, number[]>();
    old_words.forEach((word, idx) => {
        const existing = old_word_positions.get(word) || [];
        existing.push(idx);
        old_word_positions.set(word, existing);
    });

    // Track which old words have been matched
    const matched_old = new Set<number>();

    let old_idx = 0;
    let new_idx = 0;
    let position = 0;

    while (new_idx < new_words.length || old_idx < old_words.length) {
        if (new_idx >= new_words.length) {
            // Remaining old words are removed
            while (old_idx < old_words.length) {
                if (!matched_old.has(old_idx)) {
                    changes.push({
                        type: "removed",
                        text: old_words[old_idx],
                        category: classify_text(old_words[old_idx]),
                        position,
                    });
                }
                old_idx++;
                position++;
            }
            break;
        }

        if (old_idx >= old_words.length) {
            // Remaining new words are added
            while (new_idx < new_words.length) {
                changes.push({
                    type: "added",
                    text: new_words[new_idx],
                    category: classify_text(new_words[new_idx]),
                    position,
                });
                new_idx++;
                position++;
            }
            break;
        }

        const old_word = old_words[old_idx];
        const new_word = new_words[new_idx];

        if (old_word === new_word) {
            // Words match - unchanged
            changes.push({
                type: "unchanged",
                text: new_word,
                category: classify_text(new_word),
                position,
            });
            matched_old.add(old_idx);
            old_idx++;
            new_idx++;
            position++;
        } else {
            // Check if new_word exists later in old
            const future_old_positions = old_word_positions.get(new_word) || [];
            const future_match = future_old_positions.find(p => p > old_idx && !matched_old.has(p));

            // Check if old_word exists later in new
            const future_new_idx = new_words.indexOf(old_word, new_idx + 1);

            if (future_match !== undefined && (future_new_idx === -1 || future_match - old_idx <= future_new_idx - new_idx)) {
                // Old word was removed
                changes.push({
                    type: "removed",
                    text: old_word,
                    category: classify_text(old_word),
                    position,
                });
                old_idx++;
                position++;
            } else {
                // New word was added
                changes.push({
                    type: "added",
                    text: new_word,
                    category: classify_text(new_word),
                    position,
                });
                new_idx++;
                position++;
            }
        }
    }

    return changes;
}

/**
 * Group changes by category
 */
function group_changes_by_category(
    changes: WordChange[]
): Record<ChangeCategory, ClassifiedChange> {
    const categories: ChangeCategory[] = ["financial", "date", "party", "legal_term", "general"];
    const grouped: Record<ChangeCategory, ClassifiedChange> = {} as any;

    for (const category of categories) {
        grouped[category] = {
            category,
            added: [],
            removed: [],
            context: "",
        };
    }

    for (const change of changes) {
        if (change.type === "added") {
            grouped[change.category].added.push(change.text);
        } else if (change.type === "removed") {
            grouped[change.category].removed.push(change.text);
        }
    }

    // Build context for each category
    for (const category of categories) {
        const cat = grouped[category];
        if (cat.added.length > 0 || cat.removed.length > 0) {
            const parts: string[] = [];
            if (cat.removed.length > 0) {
                parts.push(`Removed: "${cat.removed.slice(0, 3).join(" ")}${cat.removed.length > 3 ? "..." : ""}"`);
            }
            if (cat.added.length > 0) {
                parts.push(`Added: "${cat.added.slice(0, 3).join(" ")}${cat.added.length > 3 ? "..." : ""}"`);
            }
            cat.context = parts.join("; ");
        }
    }

    return grouped;
}

/**
 * Calculate change severity based on categories and volume
 */
function calculate_severity(
    changes: WordChange[],
    grouped: Record<ChangeCategory, ClassifiedChange>
): "minor" | "moderate" | "major" | "critical" {
    const total_changes = changes.filter(c => c.type !== "unchanged").length;
    const total_words = changes.length;

    // Critical if financial or legal term changes are significant
    const financial_changes = grouped.financial.added.length + grouped.financial.removed.length;
    const legal_changes = grouped.legal_term.added.length + grouped.legal_term.removed.length;
    const party_changes = grouped.party.added.length + grouped.party.removed.length;
    const date_changes = grouped.date.added.length + grouped.date.removed.length;

    if (financial_changes > 5 || party_changes > 3) {
        return "critical";
    }

    if (financial_changes > 0 || legal_changes > 3 || party_changes > 0) {
        return "major";
    }

    if (date_changes > 0 || legal_changes > 0 || (total_changes / total_words) > 0.3) {
        return "moderate";
    }

    return "minor";
}

/**
 * Generate HTML redline markup
 */
function generate_redline_html(changes: WordChange[]): string {
    const parts: string[] = [];

    for (const change of changes) {
        if (change.type === "added") {
            parts.push(`<ins class="redline-add" data-category="${change.category}">${escapeHtml(change.text)}</ins>`);
        } else if (change.type === "removed") {
            parts.push(`<del class="redline-del" data-category="${change.category}">${escapeHtml(change.text)}</del>`);
        } else {
            parts.push(escapeHtml(change.text));
        }
    }

    return parts.join("");
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Generate full redline analysis
 */
export function generate_redline(old_text: string, new_text: string): RedlineResult {
    const word_changes = compute_word_diff(old_text, new_text);
    const classified_changes = group_changes_by_category(word_changes);

    const by_category: Record<ChangeCategory, number> = {
        financial: classified_changes.financial.added.length + classified_changes.financial.removed.length,
        date: classified_changes.date.added.length + classified_changes.date.removed.length,
        party: classified_changes.party.added.length + classified_changes.party.removed.length,
        legal_term: classified_changes.legal_term.added.length + classified_changes.legal_term.removed.length,
        general: classified_changes.general.added.length + classified_changes.general.removed.length,
    };

    const total_changes = Object.values(by_category).reduce((a, b) => a + b, 0);
    const severity = calculate_severity(word_changes, classified_changes);

    return {
        word_changes,
        classified_changes,
        summary: {
            total_changes,
            by_category,
            severity,
        },
        redline_html: generate_redline_html(word_changes),
    };
}

/**
 * Generate a human-readable change summary
 */
export function generate_change_narrative(result: RedlineResult): string {
    const parts: string[] = [];

    parts.push(`Change severity: ${result.summary.severity.toUpperCase()}`);
    parts.push(`Total changes: ${result.summary.total_changes}`);

    if (result.summary.by_category.financial > 0) {
        parts.push(`⚠️ Financial changes detected (${result.summary.by_category.financial})`);
    }
    if (result.summary.by_category.party > 0) {
        parts.push(`⚠️ Party/entity changes detected (${result.summary.by_category.party})`);
    }
    if (result.summary.by_category.date > 0) {
        parts.push(`📅 Date changes detected (${result.summary.by_category.date})`);
    }
    if (result.summary.by_category.legal_term > 0) {
        parts.push(`📜 Legal term changes detected (${result.summary.by_category.legal_term})`);
    }

    return parts.join("\n");
}
