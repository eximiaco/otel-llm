import { EmbedderLoop } from './embedder.loop';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

async function main(): Promise<void> {
  const loop = new EmbedderLoop({
    lokiUrl: process.env.LOKI_URL ?? 'http://localhost:3100',
    lokiQuery: process.env.LOKI_QUERY ?? '{source="alloy-otel"}',
    db: {
      host: process.env.DB_HOST ?? 'localhost',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      user: process.env.DB_USER ?? 'admin',
      password: process.env.DB_PASSWORD ?? '123456',
      database: process.env.DB_NAME ?? 'eximia_otel',
    },
    openaiApiKey: requireEnv('OPENAI_API_KEY'),
    openaiEmbeddingModel:
      process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
    pollIntervalMs: parseInt(process.env.EMBED_POLL_INTERVAL_MS ?? '30000', 10),
    batchSize: parseInt(process.env.EMBED_BATCH_SIZE ?? '32', 10),
    lookbackHours: parseInt(process.env.EMBED_LOOKBACK_HOURS ?? '24', 10),
  });

  const shutdown = async () => {
    await loop.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  await loop.start();
}

main().catch((error) => {
  console.error('[log-embedder] fatal:', error);
  process.exit(1);
});
