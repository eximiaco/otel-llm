CREATE TABLE IF NOT EXISTS log_embedder_cursor (
  id TEXT PRIMARY KEY DEFAULT 'default',
  last_ns BIGINT NOT NULL DEFAULT 0
);

INSERT INTO log_embedder_cursor (id, last_ns) VALUES ('default', 0)
ON CONFLICT (id) DO NOTHING;
