/**
 * Webhook signature verification.
 *
 * Both verify functions are fail-closed: if the configured secret is
 * missing they return false and the route should respond 503. We do
 * this rather than 401/403 because the *server* is misconfigured, not
 * the *caller*.
 *
 * Compares are constant-time via crypto.timingSafeEqual.
 */

import crypto from "crypto";

function safe_eq(a: Buffer, b: Buffer): boolean {
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
}

/**
 * GitHub: x-hub-signature-256 = "sha256=<hex>" of HMAC-SHA256(secret, raw_body).
 * https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries
 */
export function verify_github_signature(
    raw_body: Buffer | string | undefined,
    header_value: string | undefined,
    secret: string | undefined,
): { ok: boolean; reason?: string } {
    if (!secret) return { ok: false, reason: "secret_missing" };
    if (!header_value || typeof header_value !== "string")
        return { ok: false, reason: "header_missing" };
    if (!header_value.startsWith("sha256="))
        return { ok: false, reason: "bad_format" };
    if (raw_body === undefined)
        return { ok: false, reason: "raw_body_missing" };

    const body_buf = Buffer.isBuffer(raw_body)
        ? raw_body
        : Buffer.from(String(raw_body));
    const expected = crypto
        .createHmac("sha256", secret)
        .update(body_buf)
        .digest("hex");
    const provided = header_value.slice("sha256=".length);

    let provided_buf: Buffer;
    try {
        provided_buf = Buffer.from(provided, "hex");
    } catch {
        return { ok: false, reason: "bad_hex" };
    }
    const expected_buf = Buffer.from(expected, "hex");
    if (!safe_eq(provided_buf, expected_buf))
        return { ok: false, reason: "mismatch" };
    return { ok: true };
}

/**
 * Notion: As of 2024 Notion does not specify a public webhook signature
 * scheme for direct integrations (their automations product uses a
 * "Notion-Signature" header on outbound webhook subscriptions). We
 * implement HMAC-SHA256 over the raw body keyed by OM_NOTION_WEBHOOK_SECRET
 * with the header `x-notion-signature` carrying the hex digest. If the
 * secret is unset we fail closed.
 *
 * If a future Notion product change ships a different format, swap the
 * verify here — call sites in routes/sources.ts only check ok/reason.
 */
export function verify_notion_signature(
    raw_body: Buffer | string | undefined,
    header_value: string | undefined,
    secret: string | undefined,
): { ok: boolean; reason?: string } {
    if (!secret) return { ok: false, reason: "secret_missing" };
    if (!header_value || typeof header_value !== "string")
        return { ok: false, reason: "header_missing" };
    if (raw_body === undefined)
        return { ok: false, reason: "raw_body_missing" };

    const body_buf = Buffer.isBuffer(raw_body)
        ? raw_body
        : Buffer.from(String(raw_body));
    const expected = crypto
        .createHmac("sha256", secret)
        .update(body_buf)
        .digest("hex");

    // accept either bare hex or "sha256=<hex>"
    const provided = header_value.startsWith("sha256=")
        ? header_value.slice("sha256=".length)
        : header_value;

    let provided_buf: Buffer;
    try {
        provided_buf = Buffer.from(provided, "hex");
    } catch {
        return { ok: false, reason: "bad_hex" };
    }
    const expected_buf = Buffer.from(expected, "hex");
    if (!safe_eq(provided_buf, expected_buf))
        return { ok: false, reason: "mismatch" };
    return { ok: true };
}
