import { Inject, Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EmbeddingService } from '../log-embedder/embedding.service';
import { EMBEDDING_SERVICE } from '../logs-search/logs-search.service';
import { toVectorLiteral } from '../shared/vector.util';
import type { LogEvidence, QueryPlanFilters } from './query-plan.types';

interface RagRow {
  id: string;
  content: string;
  loki_ts: Date;
  trace_id: string | null;
  service: string;
  level: string;
  route: string | null;
  http_method: string | null;
  status_code: number | null;
  score: string;
}

@Injectable()
export class LogRagService {
  private readonly minScore: number;

  constructor(
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(EMBEDDING_SERVICE)
    private readonly embeddings: EmbeddingService | null,
  ) {
    this.minScore = parseFloat(process.env.RAG_MIN_SCORE ?? '0.65');
  }

  async retrieve(
    query: string,
    since: Date,
    until: Date,
    limit: number,
    filters: QueryPlanFilters,
  ): Promise<LogEvidence[]> {
    if (!this.embeddings) return [];

    const vector = await this.embeddings.embedQuery(query);
    const conditions = [
      'embedding IS NOT NULL',
      'loki_ts >= $2',
      'loki_ts < $3',
    ];
    const params: unknown[] = [toVectorLiteral(vector), since, until];
    let paramIdx = 4;

    if (filters.level) {
      conditions.push(`level = $${paramIdx}`);
      params.push(filters.level);
      paramIdx++;
    }

    if (filters.route) {
      conditions.push(`route = $${paramIdx}`);
      params.push(filters.route);
      paramIdx++;
    }

    if (filters.httpMethod) {
      conditions.push(`http_method = $${paramIdx}`);
      params.push(filters.httpMethod.toUpperCase());
      paramIdx++;
    }

    params.push(limit);

    const rows = await this.dataSource.query<RagRow[]>(
      `SELECT id, content, loki_ts, trace_id, service, level,
              route, http_method, status_code,
              1 - (embedding <=> $1::vector) AS score
       FROM log_embeddings
       WHERE ${conditions.join(' AND ')}
       ORDER BY embedding <=> $1::vector
       LIMIT $${paramIdx}`,
      params,
    );

    return rows
      .map((row) => ({
        id: row.id,
        content: row.content,
        lokiTs: new Date(row.loki_ts).toISOString(),
        level: row.level,
        service: row.service,
        route: row.route ?? undefined,
        httpMethod: row.http_method ?? undefined,
        statusCode: row.status_code ?? undefined,
        traceId: row.trace_id ?? undefined,
        score: Number(row.score),
      }))
      .filter((row) => row.score >= this.minScore);
  }
}
