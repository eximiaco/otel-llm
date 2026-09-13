import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { LogAnalyticsRepository } from './log-analytics.repository';
import { LogRagService } from './log-rag.service';
import { LogsAnswerService } from './logs-answer.service';
import { QueryPlannerService } from './query-planner.service';
import { resolveTimeRange } from './time-window.util';
import type { LogAskResponseDto } from './dto/log-ask-response.dto';
import type { LogEvidence, QueryPlan } from './query-plan.types';

@Injectable()
export class LogsQaService {
  constructor(
    private readonly planner: QueryPlannerService,
    private readonly analytics: LogAnalyticsRepository,
    private readonly rag: LogRagService,
    private readonly answer: LogsAnswerService,
  ) {}

  async ask(question: string): Promise<LogAskResponseDto> {
    if (!process.env.OPENAI_API_KEY) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is required for log Q&A',
      );
    }

    const plan = await this.planner.plan(question);
    if (plan.mode === 'unsupported') {
      return {
        answer: `Não é possível responder a essa consulta com os logs disponíveis. ${plan.unsupportedReason}`,
        plan: plan as unknown as Record<string, unknown>,
      };
    }

    const { since, until } = resolveTimeRange(plan.timeWindow);

    const data: LogAskResponseDto['data'] = {};
    const metricsForAnswer: {
      failureCount?: Awaited<
        ReturnType<LogAnalyticsRepository['countFailures']>
      >;
      topRoutes?: Awaited<
        ReturnType<LogAnalyticsRepository['topRoutesByFailures']>
      >;
      requestCount?: Awaited<
        ReturnType<LogAnalyticsRepository['countHttpRequests']>
      >;
    } = {};

    if (plan.mode === 'aggregate' || plan.mode === 'hybrid') {
      await this.runAggregate(plan, since, until, data, metricsForAnswer);
    }

    const evidence = await this.fetchEvidence(plan, question, since, until);

    const answerText = await this.answer.synthesize(
      question,
      plan,
      metricsForAnswer,
      evidence,
    );

    return {
      answer: answerText,
      plan: plan as unknown as Record<string, unknown>,
      data:
        data.failureCount || data.requestCount || data.topRoutes?.length
          ? data
          : undefined,
      evidence: evidence.length > 0 ? evidence : undefined,
    };
  }

  private async runAggregate(
    plan: QueryPlan,
    since: Date,
    until: Date,
    data: NonNullable<LogAskResponseDto['data']>,
    metrics: {
      failureCount?: Awaited<
        ReturnType<LogAnalyticsRepository['countFailures']>
      >;
      topRoutes?: Awaited<
        ReturnType<LogAnalyticsRepository['topRoutesByFailures']>
      >;
      requestCount?: Awaited<
        ReturnType<LogAnalyticsRepository['countHttpRequests']>
      >;
    },
  ): Promise<void> {
    switch (plan.aggregation) {
      case 'count_failures': {
        const failureCount = await this.analytics.countFailures(
          since,
          until,
          plan.filters,
        );
        metrics.failureCount = failureCount;
        data.failureCount = failureCount;
        break;
      }
      case 'top_route_by_count': {
        const topRoutes = await this.analytics.topRoutesByFailures(
          since,
          until,
          plan.limit,
        );
        metrics.topRoutes = topRoutes;
        data.topRoutes = topRoutes;
        break;
      }
      case 'count_http_requests': {
        const { httpMethod, route } = plan.filters;
        if (!httpMethod || !route) break;
        const requestCount = await this.analytics.countHttpRequests(
          since,
          until,
          httpMethod,
          route,
        );
        metrics.requestCount = requestCount;
        data.requestCount = requestCount;
        break;
      }
    }
  }

  private async fetchEvidence(
    plan: QueryPlan,
    question: string,
    since: Date,
    until: Date,
  ): Promise<LogEvidence[]> {
    const limit = Math.min(plan.limit, 50);
    let evidence: LogEvidence[] = [];

    if (plan.listLogs) {
      evidence = await this.listFromSql(plan, since, until, limit);
    }

    if (
      evidence.length === 0 &&
      (plan.mode === 'rag' || plan.mode === 'hybrid')
    ) {
      evidence = await this.rag.retrieve(
        plan.ragQuery ?? question,
        since,
        until,
        limit,
        plan.filters,
      );
    }

    return evidence;
  }

  private async listFromSql(
    plan: QueryPlan,
    since: Date,
    until: Date,
    limit: number,
  ): Promise<LogEvidence[]> {
    const { httpMethod, route } = plan.filters;

    if (httpMethod && route) {
      const byContent = await this.analytics.listHttpRequestLogs(
        since,
        until,
        httpMethod,
        route,
        limit,
      );
      if (byContent.length > 0) return byContent;
    }

    if (httpMethod && route) {
      const byRoute = await this.analytics.listLogs(
        since,
        until,
        plan.filters,
        limit,
        false,
      );
      if (byRoute.length > 0) return byRoute;
    }

    const errorsOnly =
      plan.aggregation === 'count_failures' || plan.filters.level === 'ERROR';

    return this.analytics.listLogs(
      since,
      until,
      plan.filters,
      limit,
      errorsOnly,
    );
  }
}
