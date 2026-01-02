-- Migration 001: Enable pgvector extension
-- Description: Adds pgvector extension for efficient vector similarity search
-- This enables native vector operations and indexing in PostgreSQL

-- Enable pgvector extension (requires superuser or rds_superuser role)
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify extension is installed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_extension WHERE extname = 'vector'
    ) THEN
        RAISE EXCEPTION 'pgvector extension is not installed. Please install it first: https://github.com/pgvector/pgvector';
    END IF;
END $$;
