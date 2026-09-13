import {
  Inject,
  Injectable,
  Optional,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../log-embedder/embedding.service';
import { toVectorLiteral } from '../shared/vector.util';
import { LogSearchHitDto } from './dto/log-search-hit.dto';

export const EMBEDDING_SERVICE = 'EMBEDDING_SERVICE';

interface LogSearchRow {
  id: string;
  content: string;
  loki_ts: Date;
  trace_id: string | null;
  service: string;
  level: string;
  score: string;
}

@Injectable()
export class LogsSearchService {
  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddings: EmbeddingService | null,
  ) {}

  async search(query: string, limit: number): Promise<LogSearchHitDto[]> {
    if (!this.embeddings) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is required for log search',
      );
    }
    const vector = await this.embeddings.embedQuery(query);
    const rows = await this.dataSource.query<LogSearchRow[]>(
      `SELECT id, content, loki_ts, trace_id, service, level,
              1 - (embedding <=> $1::vector) AS score
       FROM log_embeddings
       WHERE embedding IS NOT NULL
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [toVectorLiteral(vector), limit],
    );

    return rows.map((row) => ({
      id: row.id,
      content: row.content,
      lokiTs: new Date(row.loki_ts).toISOString(),
      traceId: row.trace_id ?? undefined,
      service: row.service,
      level: row.level,
      score: Number(row.score),
    }));
  }
}

export function createEmbeddingService(): EmbeddingService | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  return new EmbeddingService(
    apiKey,
    process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small',
  );
}
