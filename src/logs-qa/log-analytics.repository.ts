import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  httpRequestLogRegex,
  normalizeRoutePath,
} from '../log-embedder/http-request.parse';
import type {
  FailureCountResult,
  HttpRequestCountResult,
  LogEvidence,
  QueryPlanFilters,
  RouteFailureRow,
} from './query-plan.types';

interface HttpLogRow {
  id: string;
  content: string;
  loki_ts: Date;
  trace_id: string | null;
  service: string;
  level: string;
  route: string | null;
  http_method: string | null;
  status_code: number | null;
}

@Injectable()
export class LogAnalyticsRepository {
  constructor(private readonly dataSource: DataSource) {}

  async countFailures(
    since: Date,
    until: Date,
    filters: QueryPlanFilters = {},
  ): Promise<FailureCountResult> {
    const { clause, params } = this.buildFailureFilterClause(filters, 3);
    const rows = await this.dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count
       FROM log_embeddings
       WHERE loki_ts >= $1 AND loki_ts < $2
         AND ${clause}`,
      [since, until, ...params],
    );
    return {
      count: parseInt(rows[0]?.count ?? '0', 10),
      since: since.toISOString(),
      until: until.toISOString(),
    };
  }

  async topRoutesByFailures(
    since: Date,
    until: Date,
    limit: number,
  ): Promise<RouteFailureRow[]> {
    const rows = await this.dataSource.query<
      {
        route: string;
        http_method: string | null;
        failures: string;
      }[]
    >(
      `SELECT route, http_method, count(*)::text AS failures
       FROM log_embeddings
       WHERE loki_ts >= $1 AND loki_ts < $2
         AND route IS NOT NULL
         AND (level = 'ERROR' OR status_code >= 500)
       GROUP BY route, http_method
       ORDER BY count(*) DESC
       LIMIT $3`,
      [since, until, limit],
    );

    return rows.map((row) => ({
      route: row.route,
      httpMethod: row.http_method,
      failures: parseInt(row.failures, 10),
    }));
  }

  async countHttpRequests(
    since: Date,
    until: Date,
    httpMethod: string,
    route: string,
  ): Promise<HttpRequestCountResult> {
    const method = httpMethod.toUpperCase();
    const normalizedRoute = normalizeRoutePath(route);
    const regex = httpRequestLogRegex(method, normalizedRoute);

    const rows = await this.dataSource.query<{ count: string }[]>(
      `SELECT count(*)::text AS count
       FROM log_embeddings
       WHERE loki_ts >= $1 AND loki_ts < $2
         AND content ~* $3`,
      [since, until, regex],
    );

    return {
      count: parseInt(rows[0]?.count ?? '0', 10),
      httpMethod: method,
      route: normalizedRoute,
      since: since.toISOString(),
      until: until.toISOString(),
    };
  }

  async listLogs(
    since: Date,
    until: Date,
    filters: QueryPlanFilters,
    limit: number,
    errorsOnly = false,
  ): Promise<LogEvidence[]> {
    const { clause, params } = this.buildFilterClause(filters, 3, errorsOnly);

    const rows = await this.dataSource.query<HttpLogRow[]>(
      `SELECT id, content, loki_ts, trace_id, service, level,
              route, http_method, status_code
       FROM log_embeddings
       WHERE loki_ts >= $1 AND loki_ts < $2
         AND ${clause}
       ORDER BY loki_ts DESC
       LIMIT $${3 + params.length}`,
      [since, until, ...params, limit],
    );

    return rows.map((row) => this.toEvidence(row));
  }

  async listErrorLogs(
    since: Date,
    until: Date,
    filters: QueryPlanFilters,
    limit: number,
  ): Promise<LogEvidence[]> {
    return this.listLogs(since, until, filters, limit, true);
  }

  async listHttpRequestLogs(
    since: Date,
    until: Date,
    httpMethod: string,
    route: string,
    limit: number,
  ): Promise<LogEvidence[]> {
    const method = httpMethod.toUpperCase();
    const normalizedRoute = normalizeRoutePath(route);
    const regex = httpRequestLogRegex(method, normalizedRoute);

    const rows = await this.dataSource.query<HttpLogRow[]>(
      `SELECT id, content, loki_ts, trace_id, service, level,
              route, http_method, status_code
       FROM log_embeddings
       WHERE loki_ts >= $1 AND loki_ts < $2
         AND content ~* $3
       ORDER BY loki_ts DESC
       LIMIT $4`,
      [since, until, regex, limit],
    );

    return rows.map((row) => this.toEvidence(row));
  }

  private buildFilterClause(
    filters: QueryPlanFilters,
    startIdx: number,
    errorsOnly: boolean,
  ): { clause: string; params: unknown[] } {
    const parts: string[] = [];
    const params: unknown[] = [];
    let idx = startIdx;

    if (errorsOnly) {
      parts.push(`(level = 'ERROR' OR status_code >= 500)`);
    } else if (filters.level) {
      parts.push(`level = $${idx}`);
      params.push(filters.level);
      idx++;
    }

    if (filters.route) {
      parts.push(`route = $${idx}`);
      params.push(filters.route);
      idx++;
    }

    if (filters.httpMethod) {
      parts.push(`http_method = $${idx}`);
      params.push(filters.httpMethod.toUpperCase());
    }

    return {
      clause: parts.length > 0 ? parts.join(' AND ') : 'TRUE',
      params,
    };
  }

  private buildFailureFilterClause(
    filters: QueryPlanFilters,
    startIdx: number,
  ): { clause: string; params: unknown[] } {
    return this.buildFilterClause(filters, startIdx, true);
  }

  private toEvidence(row: HttpLogRow): LogEvidence {
    return {
      id: row.id,
      content: row.content,
      lokiTs: new Date(row.loki_ts).toISOString(),
      level: row.level,
      service: row.service,
      route: row.route ?? undefined,
      httpMethod: row.http_method ?? undefined,
      statusCode: row.status_code ?? undefined,
      traceId: row.trace_id ?? undefined,
    };
  }
}
