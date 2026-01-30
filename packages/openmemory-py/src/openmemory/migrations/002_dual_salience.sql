-- 002_dual_salience.sql
-- Add slow-decay salience column for long-term wisdom retention
-- salience: fast decay (λ=0.05, ~14 day half-life) for recent relevance
-- salience_slow: slow decay (λ=0.001, ~2 year half-life) for wisdom retention

ALTER TABLE memories ADD COLUMN salience_slow REAL DEFAULT 0.5;

-- Backfill existing memories: set salience_slow equal to current salience
UPDATE memories SET salience_slow = salience WHERE salience_slow IS NULL;

-- Create index for wisdom queries (sorting by slow salience)
CREATE INDEX IF NOT EXISTS idx_memories_salience_slow ON memories(salience_slow DESC);

-- Also add index for fast salience queries
CREATE INDEX IF NOT EXISTS idx_memories_salience ON memories(salience DESC);
