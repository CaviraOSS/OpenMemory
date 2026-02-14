/**
 * Safe Regex Utilities
 *
 * Provides ReDoS-resistant regex operations for user-provided patterns.
 * Detects potentially dangerous patterns and adds execution safeguards.
 */

/**
 * Result of regex safety analysis
 */
export interface RegexSafetyResult {
    safe: boolean;
    reason?: string;
    complexity?: "low" | "medium" | "high" | "dangerous";
}

/**
 * Patterns that indicate potential ReDoS vulnerability
 * These detect nested quantifiers and overlapping alternations
 */
const REDOS_INDICATORS = [
    // Nested quantifiers: (a+)+ or (a*)*
    /\([^)]*[+*]\)[+*]/,
    // Overlapping alternations with quantifiers: (a|a)+
    /\(([^|)]+)\|\1[^)]*\)[+*]/,
    // Quantified groups followed by similar patterns: (a+)+a
    /\([^)]*[+*]\)[+*][^)]*$/,
    // Multiple adjacent quantifiers
    /[+*]{2,}/,
    // Backreferences with quantifiers
    /\\[1-9][+*]/,
    // Very long alternations (could cause backtracking)
    /\([^)]{100,}\)/,
];

/**
 * Maximum allowed pattern length
 */
const MAX_PATTERN_LENGTH = 500;

/**
 * Maximum allowed execution time in milliseconds
 */
const DEFAULT_TIMEOUT_MS = 100;

/**
 * Analyse a regex pattern for potential ReDoS vulnerabilities
 */
export function analyse_regex_safety(pattern: string): RegexSafetyResult {
    // Check pattern length
    if (pattern.length > MAX_PATTERN_LENGTH) {
        return {
            safe: false,
            reason: `Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters`,
            complexity: "dangerous",
        };
    }

    // Check for ReDoS indicators
    for (const indicator of REDOS_INDICATORS) {
        if (indicator.test(pattern)) {
            return {
                safe: false,
                reason: "Pattern contains potentially dangerous nested quantifiers",
                complexity: "dangerous",
            };
        }
    }

    // Count quantifiers for complexity assessment
    const quantifier_count = (pattern.match(/[+*?]|\{[\d,]+\}/g) || []).length;
    const group_count = (pattern.match(/\(/g) || []).length;
    const complexity_score = quantifier_count * group_count;

    if (complexity_score > 20) {
        return {
            safe: false,
            reason: "Pattern complexity is too high (too many quantifiers in groups)",
            complexity: "high",
        };
    }

    if (complexity_score > 10) {
        return {
            safe: true,
            reason: "Pattern has moderate complexity",
            complexity: "medium",
        };
    }

    return {
        safe: true,
        complexity: "low",
    };
}

/**
 * Create a safe RegExp from a user-provided pattern
 * Returns null if the pattern is invalid or potentially dangerous
 */
export function create_safe_regex(
    pattern: string,
    flags?: string,
    options?: { allow_unsafe?: boolean }
): RegExp | null {
    // Validate the pattern syntax first
    try {
        new RegExp(pattern);
    } catch {
        return null;
    }

    // Check for ReDoS unless explicitly allowed
    if (!options?.allow_unsafe) {
        const safety = analyse_regex_safety(pattern);
        if (!safety.safe) {
            console.warn(`[safe_regex] Rejected unsafe pattern: ${safety.reason}`);
            return null;
        }
    }

    return new RegExp(pattern, flags);
}

/**
 * Execute a regex match with timeout protection
 * Uses a simple string length heuristic to estimate execution time
 *
 * @param regex The regex to execute
 * @param content The content to match against
 * @param timeout_ms Maximum execution time in milliseconds
 * @returns Match result or null if timeout would likely occur
 */
export function safe_regex_exec(
    regex: RegExp,
    content: string,
    timeout_ms: number = DEFAULT_TIMEOUT_MS
): RegExpExecArray | null {
    // For very long content with complex patterns, check if execution is likely safe
    // This is a heuristic - true regex timeout would require worker threads
    const estimated_ops = content.length * (regex.source.length || 1);
    const max_ops = timeout_ms * 10000; // Rough estimate: 10k ops per ms

    if (estimated_ops > max_ops) {
        console.warn(
            `[safe_regex] Skipping regex exec on large content (${content.length} chars)`
        );
        return null;
    }

    return regex.exec(content);
}

/**
 * Execute a regex test with timeout protection
 */
export function safe_regex_test(
    regex: RegExp,
    content: string,
    timeout_ms: number = DEFAULT_TIMEOUT_MS
): boolean {
    const estimated_ops = content.length * (regex.source.length || 1);
    const max_ops = timeout_ms * 10000;

    if (estimated_ops > max_ops) {
        console.warn(
            `[safe_regex] Skipping regex test on large content (${content.length} chars)`
        );
        return false;
    }

    return regex.test(content);
}

/**
 * Find all matches with safety limits
 */
export function safe_regex_match_all(
    regex: RegExp,
    content: string,
    options?: {
        max_matches?: number;
        timeout_ms?: number;
    }
): RegExpExecArray[] {
    const max_matches = options?.max_matches ?? 1000;
    const timeout_ms = options?.timeout_ms ?? DEFAULT_TIMEOUT_MS;

    // Ensure global flag is set
    const global_regex = regex.global
        ? regex
        : new RegExp(regex.source, regex.flags + "g");

    const matches: RegExpExecArray[] = [];
    const start_time = Date.now();

    let match;
    while ((match = global_regex.exec(content)) !== null) {
        matches.push(match);

        // Check limits
        if (matches.length >= max_matches) {
            console.warn(
                `[safe_regex] Match limit reached (${max_matches} matches)`
            );
            break;
        }

        if (Date.now() - start_time > timeout_ms) {
            console.warn(
                `[safe_regex] Timeout reached after ${matches.length} matches`
            );
            break;
        }

        // Prevent infinite loop for zero-width matches
        if (match[0].length === 0) {
            global_regex.lastIndex++;
        }
    }

    return matches;
}
