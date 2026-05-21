import { createHmac, timingSafeEqual } from "node:crypto";

type HeaderMap = Record<string, string | string[] | undefined>;
type SecretMap = Record<string, string | undefined>;

export type SourceSignatureResult = {
  ok: boolean;
  required: boolean;
  reason?: string;
  secret_env?: string;
};

const normalizeSource = (source: string) =>
  source
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

const sourceSecretEnv = (source: string) => {
  const normalized = normalizeSource(source);
  const base = normalized.endsWith("_WEBHOOK")
    ? normalized.slice(0, -"_WEBHOOK".length)
    : normalized;
  return `OM_${base}_WEBHOOK_SECRET`;
};

const firstHeader = (headers: HeaderMap, names: string[]) => {
  const entries = Object.entries(headers).map(([key, value]) => [
    key.toLowerCase(),
    value,
  ]);
  for (const name of names) {
    const match = entries.find(([key]) => key === name.toLowerCase())?.[1];
    if (Array.isArray(match)) return match[0];
    if (typeof match === "string") return match;
  }
  return undefined;
};

const toPayloadBuffer = (rawBody: Buffer | string | undefined) => {
  if (rawBody === undefined) return undefined;
  return Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody);
};

export function signDurableSourcePayload(
  rawBody: Buffer | string,
  secret: string,
) {
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

function verifyHmac(
  rawBody: Buffer | string | undefined,
  signature: string | undefined,
  secret: string,
) {
  const payload = toPayloadBuffer(rawBody);
  if (!payload) return "raw_body_missing";
  if (!signature) return "signature_missing";

  const provided = signature.startsWith("sha256=")
    ? signature.slice("sha256=".length)
    : signature;
  if (!/^[a-f0-9]{64}$/i.test(provided)) return "bad_signature";

  const expected = createHmac("sha256", secret).update(payload).digest();
  const actual = Buffer.from(provided, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected)
    ? undefined
    : "mismatch";
}

export function verifyDurableSourceSignature(input: {
  source_kind: string;
  raw_body?: Buffer | string;
  headers?: HeaderMap;
  secrets?: SecretMap;
}): SourceSignatureResult {
  const secret_env = sourceSecretEnv(input.source_kind);
  const secret = (input.secrets || process.env)[secret_env];
  const headers = input.headers || {};
  const signature = firstHeader(headers, [
    "x-openmemory-signature",
    "x-hub-signature-256",
    "x-notion-signature",
  ]);
  const required =
    Boolean(secret) || normalizeSource(input.source_kind).endsWith("_WEBHOOK");

  if (!required) return { ok: true, required: false };
  if (!secret)
    return { ok: false, required, reason: "secret_missing", secret_env };

  const reason = verifyHmac(input.raw_body, signature, secret);
  return reason
    ? { ok: false, required, reason, secret_env }
    : { ok: true, required, secret_env };
}
