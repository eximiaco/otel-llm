DROP INDEX IF EXISTS log_embeddings_embedding_idx;

ALTER TABLE log_embeddings
  ALTER COLUMN embedding TYPE vector(768);

CREATE INDEX IF NOT EXISTS log_embeddings_embedding_idx
  ON log_embeddings
  USING hnsw (embedding vector_cosine_ops);
