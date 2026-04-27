import fs from "node:fs";

/**
 * Build the `ssl` option for a `pg.Pool` based on `OM_PG_SSL`.
 *
 * Modes:
 *   - "verify-full" (default in production): TLS with full certificate
 *     verification (Node's default `rejectUnauthorized: true`). Uses the
 *     system CA trust store unless `OM_PG_SSL_CA` points at a CA file.
 *   - "require": TLS, but accept any certificate (rejectUnauthorized: false).
 *     Logs a WARN — this is the legacy behavior and should only be used
 *     against trusted networks (e.g. private VPC).
 *   - "disable": no TLS.
 *   - unset / "": defaults to "verify-full" when NODE_ENV === "production",
 *     otherwise "disable" so local dev keeps working without certs.
 *
 * Returns either an SSL options object, the literal `false` (TLS off), or
 * `undefined` (let the pg driver pick its default). A non-undefined return
 * value gives us full control over verification.
 */
export type PgSslConfig = false | { rejectUnauthorized: boolean; ca?: string };

let warnedRequire = false;

export function resolvePgSsl(
    env: NodeJS.ProcessEnv = process.env,
): PgSslConfig {
    const raw = (env.OM_PG_SSL ?? "").trim().toLowerCase();
    const mode =
        raw || (env.NODE_ENV === "production" ? "verify-full" : "disable");

    if (mode === "disable") {
        return false;
    }

    if (mode === "require") {
        if (!warnedRequire) {
            console.warn(
                "[OpenMemory][PG][SSL] OM_PG_SSL=require: TLS enabled WITHOUT certificate verification. " +
                    "Use OM_PG_SSL=verify-full for production deployments.",
            );
            warnedRequire = true;
        }
        return { rejectUnauthorized: false };
    }

    if (mode === "verify-full") {
        const caPath = env.OM_PG_SSL_CA;
        if (caPath) {
            try {
                const ca = fs.readFileSync(caPath, "utf8");
                return { rejectUnauthorized: true, ca };
            } catch (e: any) {
                throw new Error(
                    `[OpenMemory][PG][SSL] Failed to read OM_PG_SSL_CA at ${caPath}: ${e?.message || e}`,
                );
            }
        }
        // No explicit CA: rely on Node's system trust store (default).
        return { rejectUnauthorized: true };
    }

    throw new Error(
        `[OpenMemory][PG][SSL] Unknown OM_PG_SSL value: ${JSON.stringify(raw)}. ` +
            `Expected one of: verify-full, require, disable.`,
    );
}
