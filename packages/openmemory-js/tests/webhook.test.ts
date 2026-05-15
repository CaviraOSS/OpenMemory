/**
 * Webhook HMAC verification regression guard.
 *
 * Pins the behaviour of verify_github_signature / verify_notion_signature
 * BEFORE the src/server/server.js -> server.ts port. The "raw_body missing"
 * case is the explicit regression guard: if the typed framework drops
 * raw-body capture, this test fails loudly instead of silently fail-opening
 * the webhook (the verifier returns ok:false / reason:"raw_body_missing"
 * which the route translates to 401).
 *
 * The middleware exposes pure functions, not Express-style (req,res,next)
 * middleware:
 *   verify_github_signature(raw_body, header_value, secret) -> { ok, reason? }
 *   verify_notion_signature(raw_body, header_value, secret) -> { ok, reason? }
 *
 * Routes call these via req.rawBody / req.headers[...] / process.env.* and
 * map verify.ok=false to HTTP 401 (or 503 when secret is unset).
 */

import { describe, it, expect } from "vitest";
import * as crypto from "crypto";
import {
    verify_github_signature,
    verify_notion_signature,
} from "../src/server/middleware/webhook";

const PAYLOAD = Buffer.from(JSON.stringify({ event: "ping" }));
const SECRET = "test-secret";

function github_sig(secret: string, body: Buffer): string {
    return (
        "sha256=" +
        crypto.createHmac("sha256", secret).update(body).digest("hex")
    );
}

function notion_sig(secret: string, body: Buffer): string {
    // Notion verifier accepts bare hex or "sha256=<hex>". Use bare hex to
    // mirror the README / route documentation.
    return crypto.createHmac("sha256", secret).update(body).digest("hex");
}

describe("webhook HMAC verification (GitHub)", () => {
    it("accepts a valid signature", () => {
        const result = verify_github_signature(
            PAYLOAD,
            github_sig(SECRET, PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(true);
    });

    it("rejects a forged signature with reason=mismatch", () => {
        const result = verify_github_signature(
            PAYLOAD,
            github_sig("wrong-secret", PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("mismatch");
    });

    it("rejects when the secret is missing (server misconfigured -> 503 path)", () => {
        const result = verify_github_signature(
            PAYLOAD,
            github_sig("anything", PAYLOAD),
            undefined,
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("secret_missing");
    });

    it("rejects when raw_body is missing (server framework regression guard)", () => {
        // This is the load-bearing test for the server.js -> server.ts port.
        // If the typed framework drops req.rawBody capture, the route hands
        // undefined to the verifier and we MUST fail closed.
        const result = verify_github_signature(
            undefined,
            github_sig(SECRET, PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("raw_body_missing");
    });

    it("rejects when the signature header is missing", () => {
        const result = verify_github_signature(PAYLOAD, undefined, SECRET);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("header_missing");
    });

    it("rejects when the signature header is malformed (no sha256= prefix)", () => {
        const result = verify_github_signature(PAYLOAD, "deadbeef", SECRET);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("bad_format");
    });
});

describe("webhook HMAC verification (Notion)", () => {
    it("accepts a valid bare-hex signature", () => {
        const result = verify_notion_signature(
            PAYLOAD,
            notion_sig(SECRET, PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(true);
    });

    it('accepts a valid "sha256=<hex>" prefixed signature', () => {
        const result = verify_notion_signature(
            PAYLOAD,
            "sha256=" + notion_sig(SECRET, PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(true);
    });

    it("rejects when raw_body is missing (server framework regression guard)", () => {
        const result = verify_notion_signature(
            undefined,
            notion_sig(SECRET, PAYLOAD),
            SECRET,
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("raw_body_missing");
    });

    it("rejects when the secret is missing", () => {
        const result = verify_notion_signature(
            PAYLOAD,
            notion_sig("anything", PAYLOAD),
            undefined,
        );
        expect(result.ok).toBe(false);
        expect(result.reason).toBe("secret_missing");
    });
});
