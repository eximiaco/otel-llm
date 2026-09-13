export type PlannerMode = 'aggregate' | 'rag' | 'hybrid' | 'unsupported';

export type TimeUnit = 'minute' | 'hour' | 'day';

export type Aggregation =
  | 'count_failures'
  | 'top_route_by_count'
  | 'count_http_requests'
  | 'none';

export interface TimeWindow {
  amount: number;
  unit: TimeUnit;
  calendarDay?: boolean;
}

export interface QueryPlanFilters {
  level?: string;
  route?: string;
  httpMethod?: string;
}

export interface QueryPlan {
  mode: PlannerMode;
  timeWindow: TimeWindow;
  filters: QueryPlanFilters;
  aggregation: Aggregation;
  listLogs: boolean;
  limit: number;
  ragQuery?: string;
  unsupportedReason?: string;
}

export interface FailureCountResult {
  count: number;
  since: string;
  until: string;
}

export interface RouteFailureRow {
  route: string;
  httpMethod: string | null;
  failures: number;
}

export interface HttpRequestCountResult {
  count: number;
  httpMethod: string;
  route: string;
  since: string;
  until: string;
}

export interface LogEvidence {
  id: string;
  content: string;
  lokiTs: string;
  level: string;
  service: string;
  route?: string;
  httpMethod?: string;
  statusCode?: number;
  traceId?: string;
  score?: number;
}
