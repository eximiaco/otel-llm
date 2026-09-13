import { parseHttpRequestLog } from './http-request.parse';

export interface LokiLogLine {
  lokiTs: Date;
  tsNs: bigint;
  content: string;
  labels: Record<string, string>;
  traceId: string;
  service: string;
  level: string;
  route: string | null;
  httpMethod: string | null;
  statusCode: number | null;
  lineHash: string;
}

interface LokiQueryRangeResponse {
  data?: {
    result?: Array<{
      stream?: Record<string, string>;
      values?: [string, string][];
    }>;
  };
}

function parseLevel(line: string, labels: Record<string, string>): string {
  if (labels.level) return labels.level;
  const match = line.match(/^(INFO|WARN|ERROR|DEBUG|VERBOSE|TRACE)\b/i);
  return match ? match[1].toUpperCase() : 'INFO';
}

function parseTraceId(line: string, labels: Record<string, string>): string {
  if (labels.trace_id) return labels.trace_id;
  const match = line.match(/trace_id=([a-f0-9]{32})/i);
  return match ? match[1] : '';
}

export class LokiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly query: string,
    private readonly lookbackHours: number,
  ) {}

  async fetchSince(cursorNs: bigint, limit = 5000): Promise<LokiLogLine[]> {
    const endNs = BigInt(Date.now()) * 1_000_000n;
    const startNs = resolveStartNs(cursorNs, endNs, this.lookbackHours);
    if (startNs >= endNs) return [];

    const params = new URLSearchParams({
      query: this.query,
      start: startNs.toString(),
      end: endNs.toString(),
      limit: String(limit),
      direction: 'forward',
    });

    const url = `${this.baseUrl.replace(/\/$/, '')}/loki/api/v1/query_range?${params}`;
    const response = await fetch(url);
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Loki query_range failed: ${response.status} ${body}`);
    }

    const payload = (await response.json()) as LokiQueryRangeResponse;
    const results = payload.data?.result ?? [];
    const lines: LokiLogLine[] = [];

    for (const stream of results) {
      const labels = stream.stream ?? {};
      const service =
        labels.service_name ?? labels.service ?? labels.container ?? 'unknown';

      for (const [ts, rawLine] of stream.values ?? []) {
        const tsNs = BigInt(ts);
        const lokiTs = new Date(Number(tsNs / 1_000_000n));
        const normalized = normalizeLokiLine(rawLine, labels);
        const http = parseHttpRequestLog(normalized.content);
        const labelKey = JSON.stringify(labels);
        const lineHash = await hashLine(labelKey, ts, normalized.content);

        lines.push({
          lokiTs,
          tsNs,
          content: normalized.content,
          labels,
          traceId: normalized.traceId,
          service,
          level: normalized.level,
          route: http?.route ?? null,
          httpMethod: http?.httpMethod ?? null,
          statusCode: http?.statusCode ?? null,
          lineHash,
        });
      }
    }

    lines.sort((a, b) => (a.tsNs < b.tsNs ? -1 : a.tsNs > b.tsNs ? 1 : 0));
    return lines;
  }
}

async function hashLine(
  labelKey: string,
  ts: string,
  content: string,
): Promise<string> {
  const data = new TextEncoder().encode(`${labelKey}\0${ts}\0${content}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}

function resolveStartNs(
  cursorNs: bigint,
  endNs: bigint,
  lookbackHours: number,
): bigint {
  if (cursorNs > 0n) return cursorNs;
  const lookbackNs = BigInt(lookbackHours) * 3_600n * 1_000_000_000n;
  const minStart = endNs - lookbackNs;
  return minStart > 0n ? minStart : 0n;
}

function normalizeLokiLine(
  raw: string,
  labels: Record<string, string>,
): { content: string; traceId: string; level: string } {
  try {
    const parsed = JSON.parse(raw) as {
      body?: string;
      severity?: string;
      attributes?: Record<string, string>;
    };
    if (typeof parsed.body === 'string') {
      const content = parsed.body;
      return {
        content,
        traceId:
          labels.trace_id ??
          parsed.attributes?.trace_id ??
          parseTraceId(content, labels),
        level:
          labels.level ??
          parsed.severity ??
          parseLevel(content, labels),
      };
    }
  } catch {
    /* plain text log line */
  }
  return {
    content: raw,
    traceId: parseTraceId(raw, labels),
    level: parseLevel(raw, labels),
  };
}

export function formatEmbedText(line: LokiLogLine): string {
  const parts = [`[level=${line.level}]`, `[service=${line.service}]`];
  if (line.httpMethod && line.route) {
    parts.push(`[${line.httpMethod} ${line.route}]`);
    if (line.statusCode != null) parts.push(`[status=${line.statusCode}]`);
  }
  if (line.traceId) parts.push(`[trace_id=${line.traceId}]`);
  parts.push(line.content);
  return parts.join(' ');
}
