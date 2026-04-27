/**
 * SQL identifier safety helpers.
 *
 * The package allows several identifiers (database name, schema name,
 * table names) to be supplied through environment variables. These values
 * are interpolated into raw SQL strings (e.g. `CREATE DATABASE`,
 * `CREATE TABLE`, `delete from <table>`), where Postgres / SQLite do not
 * support parameter binding for identifiers. To prevent SQL injection
 * through hostile env vars, every identifier MUST be validated before use.
 *
 * Allowed shape (intentionally conservative):
 *   - Must start with a letter (A-Z / a-z) or underscore.
 *   - Remaining characters: letters, digits, or underscore.
 *   - Length: 1..63 (Postgres' default identifier length limit).
 *
 * This rejects quoted identifiers, hyphens, dots, schema-qualified names,
 * Unicode and anything containing whitespace or punctuation. Callers that
 * need a schema-qualified name should validate each component separately
 * and assemble the quoted form themselves.
 */

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]{0,62}$/;

/**
 * Canonical default vector table name across both backends.
 * Pre-1.4 SQLite databases used `vectors`; we keep that as a recognized
 * legacy name but new installs (and Postgres) standardize on this.
 */
export const DEFAULT_VECTOR_TABLE = "openmemory_vectors";

export class UnsafeIdentifierError extends Error {
    constructor(name: string, kind: string) {
        super(
            `[OpenMemory] Refusing to use unsafe SQL identifier for ${kind}: ${JSON.stringify(name)}. ` +
                `Identifiers must match /^[A-Za-z_][A-Za-z0-9_]{0,62}$/.`,
        );
        this.name = "UnsafeIdentifierError";
    }
}

/**
 * Throws UnsafeIdentifierError if `name` is not a safe SQL identifier.
 * Returns the validated name unchanged so it can be used inline:
 *
 *   const t = assertSafeIdentifier(process.env.OM_PG_TABLE || "openmemory_memories", "OM_PG_TABLE");
 */
export function assertSafeIdentifier(
    name: string,
    kind: string = "identifier",
): string {
    if (typeof name !== "string" || !IDENTIFIER_RE.test(name)) {
        throw new UnsafeIdentifierError(name, kind);
    }
    return name;
}

/**
 * Tagged error thrown by the storage layer when initialization fails.
 * Library callers can catch this instead of the package terminating
 * the host process.
 */
export class DbInitError extends Error {
    cause?: unknown;
    constructor(message: string, cause?: unknown) {
        super(message);
        this.name = "DbInitError";
        this.cause = cause;
    }
}
