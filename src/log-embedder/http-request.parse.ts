const HTTP_REQUEST_RE =
  /http_request\s+method=(\S+)\s+route=(\S+)\s+status=(\d+)\s+duration_ms=(\d+)/i;

export interface HttpRequestFields {
  httpMethod: string;
  route: string;
  statusCode: number;
}

export function parseHttpRequestLog(content: string): HttpRequestFields | null {
  const match = content.match(HTTP_REQUEST_RE);
  if (!match) return null;
  return {
    httpMethod: match[1].toUpperCase(),
    route: match[2],
    statusCode: parseInt(match[3], 10),
  };
}

export function isHttpFailure(statusCode: number, level: string): boolean {
  if (statusCode >= 500) return true;
  return level === 'ERROR';
}

export function normalizeRoutePath(route: string): string {
  return route.startsWith('/') ? route : `/${route}`;
}

export function httpRequestLogRegex(
  httpMethod: string,
  route: string,
): string {
  const method = httpMethod.toUpperCase();
  const path = normalizeRoutePath(route).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `http_request method=${method} route=(${path}|${path}/:userId) status=`;
}

export function enrichLineFromContent<
  T extends {
    content: string;
    route: string | null;
    httpMethod: string | null;
    statusCode: number | null;
  },
>(line: T): T {
  if (line.route && line.httpMethod) return line;
  const parsed = parseHttpRequestLog(line.content);
  if (!parsed) return line;
  return {
    ...line,
    route: line.route ?? parsed.route,
    httpMethod: line.httpMethod ?? parsed.httpMethod,
    statusCode: line.statusCode ?? parsed.statusCode,
  };
}
