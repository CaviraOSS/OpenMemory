"use strict";
/**
 * Tenant Context Utilities
 *
 * Provides functions for extracting and managing tenant_id in multi-tenant mode.
 * Supports multiple extraction methods:
 * - HTTP headers
 * - JWT tokens (Supabase compatible)
 * - API key mapping
 * - Default fallback
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTenantId = getTenantId;
exports.resolveTenantId = resolveTenantId;
exports.tenantMiddleware = tenantMiddleware;
exports.isValidTenantId = isValidTenantId;
exports.sanitizeTenantId = sanitizeTenantId;
exports.getTenantIdFromJWT = getTenantIdFromJWT;
exports.getTenantIdFromApiKey = getTenantIdFromApiKey;
exports.extractTenantId = extractTenantId;
const cfg_1 = require("./cfg");
/**
 * Extract tenant_id from Express request
 *
 * Priority order:
 * 1. req.tenant_id (if already set by middleware)
 * 2. HTTP header (OM_TENANT_HEADER)
 * 3. Default tenant ID
 *
 * @param req Express request object
 * @returns tenant_id string
 */
function getTenantId(req) {
    // If multi-tenant mode is disabled, always return default tenant
    if (!cfg_1.env.multi_tenant) {
        return cfg_1.env.default_tenant_id;
    }
    // Check if already set by middleware
    if (req.tenant_id) {
        return req.tenant_id;
    }
    // Extract from HTTP header
    const headerValue = req.headers[cfg_1.env.tenant_header.toLowerCase()];
    if (headerValue) {
        return headerValue;
    }
    // Fallback to default
    return cfg_1.env.default_tenant_id;
}
/**
 * Extract tenant_id from user_id + tenant_id combination
 * This is useful when both are provided in API requests
 *
 * @param options Object containing optional user_id and tenant_id
 * @returns tenant_id string
 */
function resolveTenantId(options = {}) {
    // If multi-tenant mode is disabled, always return default tenant
    if (!cfg_1.env.multi_tenant) {
        return cfg_1.env.default_tenant_id;
    }
    // Explicit tenant_id takes priority
    if (options.tenant_id) {
        return options.tenant_id;
    }
    // Fallback to default
    return cfg_1.env.default_tenant_id;
}
/**
 * Middleware to extract tenant_id from request and attach to req object
 *
 * Usage:
 *   app.use(tenantMiddleware);
 *
 * @param req Express request
 * @param res Express response
 * @param next Next function
 */
function tenantMiddleware(req, res, next) {
    req.tenant_id = getTenantId(req);
    next();
}
/**
 * Validate tenant_id format
 * Prevents injection attacks and ensures valid format
 *
 * @param tenant_id Tenant ID to validate
 * @returns true if valid, false otherwise
 */
function isValidTenantId(tenant_id) {
    // Must be non-empty
    if (!tenant_id || tenant_id.trim().length === 0) {
        return false;
    }
    // Must not contain SQL injection characters
    const invalidChars = /[';"\\\x00\n\r]/;
    if (invalidChars.test(tenant_id)) {
        return false;
    }
    // Must be reasonable length (max 256 chars)
    if (tenant_id.length > 256) {
        return false;
    }
    return true;
}
/**
 * Sanitize tenant_id to prevent injection attacks
 *
 * @param tenant_id Raw tenant ID
 * @returns Sanitized tenant ID or default if invalid
 */
function sanitizeTenantId(tenant_id) {
    if (!isValidTenantId(tenant_id)) {
        console.warn(`[Tenant] Invalid tenant_id rejected: ${tenant_id}`);
        return cfg_1.env.default_tenant_id;
    }
    return tenant_id.trim();
}
/**
 * Extract tenant_id from Supabase JWT token
 *
 * Requires @supabase/supabase-js to be installed.
 * This is an example implementation - adjust based on your JWT structure.
 *
 * @param authHeader Authorization header value (Bearer token)
 * @returns tenant_id from JWT or null if not found
 */
function getTenantIdFromJWT(authHeader) {
    // This is a placeholder implementation
    // In production, you would:
    // 1. Parse the JWT token
    // 2. Verify signature
    // 3. Extract tenant_id from claims (e.g., user.app_metadata.organization_id)
    //
    // Example with Supabase:
    // const { data: { user } } = await supabase.auth.getUser(token);
    // return user?.app_metadata?.organization_id || null;
    console.warn("[Tenant] JWT extraction not implemented - using default tenant");
    return null;
}
/**
 * API Key to Tenant ID mapping
 *
 * For production, this should be stored in database or secure config
 * This is just an example structure
 */
const API_KEY_TO_TENANT = {
// Example mappings - replace with your actual data
// 'sk_live_abc123': 'tenant_company_a',
// 'sk_live_xyz789': 'tenant_company_b',
};
/**
 * Extract tenant_id from API key
 *
 * @param apiKey API key string
 * @returns tenant_id or null if not found
 */
function getTenantIdFromApiKey(apiKey) {
    return API_KEY_TO_TENANT[apiKey] || null;
}
/**
 * Helper to get tenant_id with multiple fallback methods
 *
 * Priority:
 * 1. Explicit tenant_id parameter
 * 2. JWT token
 * 3. API key
 * 4. HTTP header
 * 5. Default tenant
 *
 * @param options Extraction options
 * @returns tenant_id string
 */
function extractTenantId(options) {
    // If multi-tenant mode disabled, always return default
    if (!cfg_1.env.multi_tenant) {
        return cfg_1.env.default_tenant_id;
    }
    // 1. Explicit tenant_id
    if (options.tenant_id) {
        return sanitizeTenantId(options.tenant_id);
    }
    // 2. JWT token
    if (options.jwtToken) {
        const fromJWT = getTenantIdFromJWT(options.jwtToken);
        if (fromJWT) {
            return sanitizeTenantId(fromJWT);
        }
    }
    // 3. API key
    if (options.apiKey) {
        const fromApiKey = getTenantIdFromApiKey(options.apiKey);
        if (fromApiKey) {
            return sanitizeTenantId(fromApiKey);
        }
    }
    // 4. HTTP header (from request)
    if (options.req) {
        const fromReq = getTenantId(options.req);
        if (fromReq && fromReq !== cfg_1.env.default_tenant_id) {
            return sanitizeTenantId(fromReq);
        }
    }
    // 5. Default fallback
    return cfg_1.env.default_tenant_id;
}
