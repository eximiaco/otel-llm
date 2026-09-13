import { Pool } from 'pg';
import { LokiClient, formatEmbedText } from './loki.client';
import { EmbeddingService } from './embedding.service';
import { LogEmbeddingRepository } from './log-embedding.repository';

export interface EmbedderConfig {
  lokiUrl: string;
  lokiQuery: string;
  db: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  openaiApiKey: string;
  openaiEmbeddingModel: string;
  pollIntervalMs: number;
  batchSize: number;
  lookbackHours: number;
}

export class EmbedderLoop {
  private readonly loki: LokiClient;
  private readonly embeddings: EmbeddingService;
  private readonly repo: LogEmbeddingRepository;
  private readonly pool: Pool;
  private running = false;

  constructor(private readonly config: EmbedderConfig) {
    this.pool = new Pool({
      host: config.db.host,
      port: config.db.port,
      user: config.db.user,
      password: config.db.password,
      database: config.db.database,
    });
    this.loki = new LokiClient(
      config.lokiUrl,
      config.lokiQuery,
      config.lookbackHours,
    );
    this.embeddings = new EmbeddingService(
      config.openaiApiKey,
      config.openaiEmbeddingModel,
    );
    this.repo = new LogEmbeddingRepository(this.pool);
  }

  async runOnce(): Promise<void> {
    const cursorNs = await this.repo.getCursorNs();
    const lines = await this.loki.fetchSince(cursorNs);
    if (lines.length === 0) return;

    let maxNs = cursorNs;
    let totalInserted = 0;

    for (
      let offset = 0;
      offset < lines.length;
      offset += this.config.batchSize
    ) {
      const chunk = lines.slice(offset, offset + this.config.batchSize);
      const embedTexts = chunk.map(formatEmbedText);
      const vectors = await this.embeddings.embedTexts(embedTexts);
      const inserted = await this.repo.insertBatch(chunk, vectors, embedTexts);
      totalInserted += inserted;

      for (const line of chunk) {
        if (line.tsNs > maxNs) maxNs = line.tsNs;
      }
    }

    if (maxNs > cursorNs) {
      await this.repo.setCursorNs(maxNs + 1n);
    }
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;

    await waitForPostgres(this.pool);

    while (this.running) {
      try {
        await this.runOnce();
      } catch (error) {
        console.error('[log-embedder] error:', error);
      }
      await sleep(this.config.pollIntervalMs);
    }
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.pool.end();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForPostgres(pool: Pool, maxAttempts = 30): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch {
      await sleep(1000);
    }
  }
  throw new Error('PostgreSQL not available after retries');
}
