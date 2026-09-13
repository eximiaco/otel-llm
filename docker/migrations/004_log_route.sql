ALTER TABLE log_embeddings ADD COLUMN IF NOT EXISTS route TEXT;
ALTER TABLE log_embeddings ADD COLUMN IF NOT EXISTS http_method TEXT;
ALTER TABLE log_embeddings ADD COLUMN IF NOT EXISTS status_code INT;
