CREATE TABLE users (
  "userId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE
);

CREATE TABLE transactions (
  "transactionId" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId" UUID NOT NULL REFERENCES users("userId"),
  value DECIMAL(15, 2) NOT NULL
);

INSERT INTO users (email) VALUES
  ('alice@example.com'),
  ('bob@example.com');

INSERT INTO transactions ("userId", value)
SELECT "userId", 100.00 FROM users WHERE email = 'alice@example.com'
UNION ALL
SELECT "userId", -50.00 FROM users WHERE email = 'alice@example.com'
UNION ALL
SELECT "userId", 200.00 FROM users WHERE email = 'bob@example.com';

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS log_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loki_ts TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  embedding vector(768),
  trace_id TEXT,
  service TEXT,
  level TEXT,
  route TEXT,
  http_method TEXT,
  status_code INT,
  labels JSONB DEFAULT '{}',
  line_hash TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS log_embeddings_embedding_idx
  ON log_embeddings
  USING hnsw (embedding vector_cosine_ops);

CREATE TABLE IF NOT EXISTS log_embedder_cursor (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_ns BIGINT NOT NULL DEFAULT 0
);

INSERT INTO log_embedder_cursor (id, last_ns) VALUES ('default', 0)
ON CONFLICT (id) DO NOTHING;
