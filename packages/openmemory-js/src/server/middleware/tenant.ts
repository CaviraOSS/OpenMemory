/**
 * Tenant identity helpers.
 *
 * After `authenticate_api_request` runs, every authenticated request will
 * have `req.tenant` populated with a stable string identity derived from
 * the API key (a SHA-256 prefix of the key, NOT the raw key, so logs and
 * stored user_id values do not leak the secret).
 *
 * Routes MUST use `require_tenant(req, res)` to derive the tenant scope
 * for all reads and writes. Body / query / path supplied user_id values
 * are NOT trusted: if a request supplies a mismatching user_id we return
 * 403 (intentional — see SECURITY note in auth.ts).
 *
 * If a future deployment needs to map a single API key to multiple
 * tenants, replace `derive_tenant_id` in auth.ts with a config lookup
 * — call sites here do not need to change.
 */

export function require_tenant(req: any, res: any): string | null {
    const tenant = (req as any).tenant;
    if (!tenant || typeof tenant !== "string") {
        res.status(401).json({
            error: "authentication_required",
            message: "tenant identity missing — auth middleware required",
        });
        return null;
    }
    return tenant;
}

/**
 * Reject the request if a caller-supplied user_id disagrees with the
 * authenticated tenant. Returns true when the request was rejected
 * (caller should `return` immediately) and false otherwise.
 *
 * Pass any candidate values pulled from req.body / req.query / req.params.
 * undefined / null / empty string are ignored (caller didn't try to set it).
 */
export function reject_tenant_mismatch(
    res: any,
    tenant: string,
    ...candidates: Array<unknown>
): boolean {
    for (const c of candidates) {
        if (c === undefined || c === null || c === "") continue;
        if (typeof c !== "string" || c !== tenant) {
            res.status(403).json({
                error: "tenant_mismatch",
                message:
                    "user_id does not match authenticated tenant; user_id is derived from the API key and must not be supplied or must equal the tenant",
            });
            return true;
        }
    }
    return false;
}
