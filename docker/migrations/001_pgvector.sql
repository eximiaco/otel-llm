CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS log_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loki_ts TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  trace_id TEXT,
  service TEXT,
  level TEXT,
  labels JSONB DEFAULT '{}',
  line_hash TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS log_embeddings_embedding_idx
  ON log_embeddings
  USING hnsw (embedding vector_cosine_ops);
