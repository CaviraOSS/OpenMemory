# Legal RAG MCP Tool Concept

> **Status:** Scaffold / Idea
> **Created:** 2026-02-16
> **Author:** Claude Code session

## Overview

A dedicated Legal RAG (Retrieval-Augmented Generation) system designed for Australian family law research, distinct from OpenMemory's general-purpose agent memory. This system prioritises **permanent storage** (no decay), **domain-specific embeddings** (voyage-law-2), and **citation-aware retrieval**.

## Why Not Just Use OpenMemory?

| Requirement | OpenMemory | Legal RAG |
|-------------|------------|-----------|
| Salience decay | ✅ Yes (by design) | ❌ No - authorities don't fade |
| Embedding model | General purpose | voyage-law-2 (44% better on legal) |
| Citation tracking | Basic metadata | AGLC4-aware, pinpoint refs |
| Document chunking | Section-based | Paragraph/section with hierarchy |
| Query style | "What did I learn?" | "Find authorities on supervised contact" |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Legal RAG System                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  MCP Server  │◄──►│  Vector DB   │◄──►│  PostgreSQL/pgvector │  │
│  │  (legal-rag) │    │  (voyage)    │    │  (no decay)          │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
│         │                                                            │
│         ▼                                                            │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                      MCP Tools                                │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  legal_rag_ingest     - Ingest case law, legislation, PDFs   │   │
│  │  legal_rag_query      - Semantic search with AGLC4 citations │   │
│  │  legal_rag_cite       - Get formatted citation for authority │   │
│  │  legal_rag_related    - Find related authorities             │   │
│  │  legal_rag_timeline   - Temporal case law evolution          │   │
│  │  legal_rag_compare    - Compare holdings across cases        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## MCP Server Design

### Tools

#### `legal_rag_ingest`

Ingest legal documents with structured metadata extraction.

```typescript
interface IngestParams {
  source: "austlii" | "jade" | "file" | "url";
  identifier: string;  // URL, case citation, or file path
  document_type: "case" | "legislation" | "commentary" | "practice_direction";
  metadata?: {
    jurisdiction?: string;
    court?: string;
    year?: number;
    parties?: string[];
  };
}

interface IngestResult {
  authority_id: string;
  citation: string;        // Formatted AGLC4 citation
  paragraphs: number;      // Number of embedded paragraphs
  key_holdings: string[];  // Auto-extracted ratio decidendi
}
```

#### `legal_rag_query`

Semantic search across the legal corpus.

```typescript
interface QueryParams {
  query: string;
  filters?: {
    document_type?: string[];
    jurisdiction?: string[];
    court_level?: string[];  // "high_court", "full_court", "single_judge"
    date_range?: { from?: string; to?: string };
  };
  k?: number;              // Number of results (default 10)
  include_context?: boolean; // Include surrounding paragraphs
}

interface QueryResult {
  authorities: Array<{
    authority_id: string;
    citation: string;
    paragraph: number;
    text: string;
    similarity: number;
    pinpoint: string;      // e.g., "[15]" or "s 60CC(2)"
  }>;
}
```

#### `legal_rag_cite`

Generate properly formatted citations.

```typescript
interface CiteParams {
  authority_id: string;
  pinpoint?: string;       // Paragraph number or section
  format?: "aglc4" | "medium_neutral" | "short";
}

// Returns: "Bondelmonte v Bondelmonte (2017) 259 CLR 662, 670 [15]"
```

### Schema

```sql
-- Authorities table (cases, legislation, etc.)
CREATE TABLE legal_authorities (
  id UUID PRIMARY KEY,
  citation TEXT NOT NULL UNIQUE,
  citation_short TEXT,
  document_type TEXT NOT NULL,
  jurisdiction TEXT,
  court TEXT,
  decision_date DATE,
  parties JSONB,
  judges JSONB,
  headnote TEXT,
  full_text TEXT,
  source_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- No decay columns - permanent storage
);

-- Paragraphs with embeddings
CREATE TABLE legal_paragraphs (
  id UUID PRIMARY KEY,
  authority_id UUID REFERENCES legal_authorities(id),
  paragraph_num INTEGER,
  text TEXT NOT NULL,
  embedding vector(1024),  -- voyage-law-2 dimensions
  is_ratio BOOLEAN DEFAULT FALSE,
  is_obiter BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON legal_paragraphs
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- Cross-references between authorities
CREATE TABLE legal_citations (
  citing_id UUID REFERENCES legal_authorities(id),
  cited_id UUID REFERENCES legal_authorities(id),
  context TEXT,  -- The citing paragraph
  treatment TEXT, -- "applied", "distinguished", "overruled", "followed"
  PRIMARY KEY (citing_id, cited_id)
);
```

## Local Scripts Integration

Scripts in `~/git/legal-tools/` for batch operations:

### `ingest-austlii.sh`

```bash
#!/bin/bash
# Bulk ingest from AustLII search results
# Usage: ./ingest-austlii.sh "family law supervised contact"

QUERY="$1"
RESULTS=$(curl -s "https://www.austlii.edu.au/cgi-bin/sinosrch.cgi?query=$QUERY&format=json")

echo "$RESULTS" | jq -r '.cases[].url' | while read url; do
  curl -X POST http://localhost:8081/ingest \
    -H "Content-Type: application/json" \
    -d "{\"source\": \"austlii\", \"identifier\": \"$url\"}"
done
```

### `update-legislation.sh`

```bash
#!/bin/bash
# Sync latest legislation from Federal Register
# Run weekly via cron

ACTS=(
  "Family Law Act 1975"
  "Federal Circuit and Family Court of Australia Act 2021"
  "Evidence Act 1995"
)

for act in "${ACTS[@]}"; do
  curl -X POST http://localhost:8081/ingest \
    -H "Content-Type: application/json" \
    -d "{\"source\": \"legislation\", \"identifier\": \"$act\"}"
done
```

## Embedding Strategy

### Model Selection

**Primary:** `voyage-law-2`
- 44% improvement over general models on legal retrieval benchmarks
- Trained on legal corpus including Australian case law
- 1024 dimensions (efficient storage)

**Fallback:** `voyage-3`
- If voyage-law-2 unavailable, voyage-3 has strong legal performance
- voyage-3-large actually outperforms voyage-law-2 now

### Chunking Strategy

Legal documents have specific structure that should be preserved:

```
Case Law:
├── Headnote (summary - high weight)
├── Catchwords (index terms)
├── Parties, Court, Judges
├── Paragraphs [1] to [N]
│   ├── Background facts
│   ├── Issues
│   ├── Reasoning (ratio decidendi) ← Flag these
│   └── Orders
└── Citations to other authorities
```

Each paragraph is embedded separately but linked to the parent authority. Paragraph numbers are preserved for pinpoint citations.

## Integration with Claude Agents

### MCP Configuration

```json
{
  "mcpServers": {
    "legal-rag": {
      "command": "node",
      "args": ["/Users/rbrenner/git/legal-rag/dist/server.js"],
      "env": {
        "VOYAGE_API_KEY": "op://homelab/voyage-ai/credential",
        "DATABASE_URL": "postgresql://legal_rag:***@localhost:5432/legal_rag"
      }
    }
  }
}
```

### Agent Usage

The `legal-research` and `barrister` agents would use these tools:

```markdown
# In agent prompt
You have access to legal_rag_query for finding relevant authorities.
Always cite authorities using legal_rag_cite with proper pinpoint references.
When comparing holdings, use legal_rag_compare to identify distinctions.
```

## Deployment Options

### Option A: Separate Service

- Independent PostgreSQL database
- Dedicated MCP server on port 8081
- Complete isolation from OpenMemory

### Option B: OpenMemory Extension

- Add "legal" sector to OpenMemory
- Disable decay for memories with `document_type: legal`
- Reuse existing infrastructure

**Recommendation:** Option A for clean separation. Legal corpus is fundamentally different from agent working memory.

## Future Enhancements

1. **AustLII Integration** - Direct API access when available
2. **JADE Premium** - If subscription acquired
3. **Practice Direction Alerts** - Auto-ingest new FCFCoA practice directions
4. **Argument Templates** - Common legal argument structures with authority slots
5. **Citation Graph** - Visualise how authorities relate and evolve

## Implementation Phases

1. **Phase 1:** Schema design and basic ingestion (manual)
2. **Phase 2:** MCP server with query/cite tools
3. **Phase 3:** AustLII scraper integration
4. **Phase 4:** Cross-citation analysis
5. **Phase 5:** Integration with legal agents

---

## Related

- OpenMemory general architecture: `/Users/rbrenner/git/OpenMemory/CLAUDE.md`
- Legal agents: `~/.claude/agents/legal/`
- Academic agents (IRAC analyser): `~/.claude/agents/academic/`
