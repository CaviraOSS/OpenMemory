# Document/Legal Features - Foundation (D0)

This document defines the foundation for document-centric and legal features in OpenMemory.

## Metadata Conventions

### Document-Centric Fields

When storing documents in OpenMemory, the following metadata fields can be used to enhance document management capabilities:

#### Core Document Fields
- `doc_type`: Type of document (e.g., "contract", "agreement", "policy", "memo", "report", "legal_document")
- `doc_version`: Version identifier for the document
- `doc_title`: Human-readable title of the document

#### Legal/Contract Fields
- `parties`: Array of parties involved in the document
  - Example: `["Company A", "Company B"]`
- `effective_date`: ISO 8601 date when the document becomes effective
  - Example: `"2026-01-15T00:00:00Z"`
- `expiration_date`: ISO 8601 date when the document expires (if applicable)
- `signing_date`: ISO 8601 date when the document was signed

#### Source and Reference Fields
- `source_url`: Original URL or location of the document
- `source_system`: System where the document originated (e.g., "google_drive", "notion", "github")
- `source_id`: Original identifier in the source system
- `external_refs`: Array of external document references or IDs

#### Change Tracking Fields
- `previous_version_id`: Memory ID of the previous version (for versioned documents)
- `change_summary`: Brief description of changes from previous version
- `diff_blob`: JSON structure containing detailed diff information

### Example Metadata Structure

```json
{
  "doc_type": "contract",
  "doc_title": "Service Agreement with Acme Corp",
  "doc_version": "2.1",
  "parties": ["OpenMemory Inc", "Acme Corp"],
  "effective_date": "2026-02-01T00:00:00Z",
  "expiration_date": "2027-02-01T00:00:00Z",
  "signing_date": "2026-01-25T00:00:00Z",
  "source_system": "google_drive",
  "source_id": "1a2b3c4d5e6f",
  "source_url": "https://drive.google.com/file/d/1a2b3c4d5e6f"
}
```

## Migration Pattern

### Additive Schema Changes

All document feature migrations follow an **additive-only** pattern to ensure backward compatibility:

1. **Never remove existing columns** - Only add new optional columns
2. **Default values** - All new columns must have sensible defaults (typically NULL or empty)
3. **Nullable fields** - New columns should be nullable unless there's a strong reason otherwise
4. **Index separately** - Add indexes in separate migration steps after verifying data integrity

### Migration Template

```typescript
// Example: Adding document metadata columns
export async function migrate_add_document_fields(db: Database) {
  // Add new columns (if they don't already exist)
  await db.exec(`
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS doc_type TEXT;
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS doc_version TEXT;
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS previous_version_id TEXT;
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS change_summary TEXT;
    ALTER TABLE memories ADD COLUMN IF NOT EXISTS diff_blob TEXT;
  `);
  
  console.log("[MIGRATION] Document fields added successfully");
}
```

### Rollback Instructions

Since migrations are additive-only, rollback is typically not required. However, if needed:

1. Document columns can be safely ignored by the application
2. Indexes can be dropped if they impact performance
3. Columns should NOT be dropped in production to prevent data loss

## Route Versioning Strategy

### API Versioning Approach

OpenMemory uses **path-based versioning** for new document features to maintain backward compatibility:

#### Version 1 (Current/Legacy)
- Base path: `/memory/*`, `/api/*`
- Maintains existing behavior
- No breaking changes

#### Version 2 (Document Features)
- Base path: `/v2/documents/*`
- New document-specific endpoints
- Separate from core memory operations

### Endpoint Organization

```
# Core Memory (v1 - existing)
POST   /memory/add
GET    /memory/:id
PATCH  /memory/:id
DELETE /memory/:id
POST   /memory/query

# Documents (v2 - new)
POST   /v2/documents                    # Create document
GET    /v2/documents/:id                # Get document
POST   /v2/documents/:id/version        # Create new version
GET    /v2/documents/:id/versions       # List versions
GET    /v2/documents/:id/diff/:other_id # Compare versions
POST   /v2/documents/:id/citations      # Add citations
GET    /v2/documents/:id/citations      # Get citations
POST   /v2/documents/search             # Document-specific search
```

### Backward Compatibility

- Existing `/memory/*` endpoints continue to work without changes
- Document metadata is stored in the same memory table but with additional fields
- Queries through `/memory/query` return documents alongside other memories
- Clients can opt into document features by using `/v2/documents/*` endpoints

### Feature Flags

Document features can be disabled via environment variables:

```bash
# Disable document versioning
OM_FEATURES_DOC_VERSIONING=false

# Disable citation tracking
OM_FEATURES_CITATIONS=false

# Disable compliance checking
OM_FEATURES_COMPLIANCE=false
```

## Implementation Phases

The document features will be implemented in phases as defined in IMPROVEMENT_PLAN.md:

### Phase 2 - Core Document Intelligence
- D1: Document versioning
- D4: Redline detection
- D9: Quick wins (document type detection, party extraction, date extraction)

### Phase 3 - Retrieval Depth
- D2: Citation tracking & reference graph
- D3: Structured metadata extraction
- D8: Clause similarity detection

### Phase 4 - Workflow Automation
- D6: Template management
- D7: Compliance rules engine

## Notes

- All document features are **optional and configurable**
- Features do not change baseline memory behavior for existing users
- Document-centric fields can be used with regular memory operations
- The `version` field already exists in the memories table and can be leveraged for document versioning
