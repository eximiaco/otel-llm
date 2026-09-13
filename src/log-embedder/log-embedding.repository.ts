import { Pool } from 'pg';
import { enrichLineFromContent } from './http-request.parse';
import type { LokiLogLine } from './loki.client';

export class LogEmbeddingRepository {
  constructor(private readonly pool: Pool) {}

  async getCursorNs(): Promise<bigint> {
    const result = await this.pool.query<{ last_ns: string }>(
      `SELECT last_ns FROM log_embedder_cursor WHERE id = 'default'`,
    );
    const row = result.rows[0];
    return row ? BigInt(row.last_ns) : 0n;
  }

  async setCursorNs(lastNs: bigint): Promise<void> {
    await this.pool.query(
      `UPDATE log_embedder_cursor SET last_ns = $1 WHERE id = 'default'`,
      [lastNs.toString()],
    );
  }

  async insertBatch(
    lines: LokiLogLine[],
    vectors: number[][],
    embedTexts: string[],
  ): Promise<number> {
    if (lines.length === 0) return 0;

    const client = await this.pool.connect();
    let inserted = 0;

    try {
      await client.query('BEGIN');

      for (let i = 0; i < lines.length; i++) {
        const line = enrichLineFromContent({
          ...lines[i],
          content: lines[i].content,
        });
        const vector = vectors[i];
        const result = await client.query(
          `INSERT INTO log_embeddings (
            loki_ts, content, embedding, trace_id, service, level,
            route, http_method, status_code, labels, line_hash
          ) VALUES ($1, $2, $3::vector, $4, $5, $6, $7, $8, $9, $10::jsonb, $11)
          ON CONFLICT (line_hash) DO UPDATE SET
            route = COALESCE(EXCLUDED.route, log_embeddings.route),
            http_method = COALESCE(EXCLUDED.http_method, log_embeddings.http_method),
            status_code = COALESCE(EXCLUDED.status_code, log_embeddings.status_code),
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding`,
          [
            line.lokiTs,
            embedTexts[i],
            toVectorLiteral(vector),
            line.traceId || null,
            line.service,
            line.level,
            line.route,
            line.httpMethod,
            line.statusCode,
            JSON.stringify(line.labels),
            line.lineHash,
          ],
        );
        if ((result.rowCount ?? 0) > 0) inserted++;
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return inserted;
  }
}

function toVectorLiteral(values: number[]): string {
  return `[${values.join(',')}]`;
}
