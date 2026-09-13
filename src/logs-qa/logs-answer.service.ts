import { Injectable } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import type {
  FailureCountResult,
  HttpRequestCountResult,
  LogEvidence,
  QueryPlan,
  RouteFailureRow,
} from './query-plan.types';

@Injectable()
export class LogsAnswerService {
  private readonly chat: ChatOpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.chat = apiKey
      ? new ChatOpenAI({
          apiKey,
          model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
          temperature: 0.2,
        })
      : null;
  }

  async synthesize(
    question: string,
    plan: QueryPlan,
    metrics: {
      failureCount?: FailureCountResult;
      topRoutes?: RouteFailureRow[];
      requestCount?: HttpRequestCountResult;
    },
    evidence: LogEvidence[],
  ): Promise<string> {
    const hasMetrics = hasMetricsData(metrics);
    const hasEvidence = evidence.length > 0;

    if (!hasMetrics && !hasEvidence) {
      return noDataAnswer(question, plan);
    }

    if (!this.chat) return formatFallbackAnswer(question, metrics, evidence);

    const context = JSON.stringify(
      {
        plan: { mode: plan.mode, aggregation: plan.aggregation },
        metrics,
        evidence: evidence.slice(0, 20).map(formatEvidenceForContext),
      },
      null,
      2,
    );

    const response = await this.chat.invoke([
      {
        role: 'system',
        content: `Você responde perguntas sobre logs em português.
Use APENAS os números em "metrics" para contagens — não invente valores.
Quando houver evidências, liste cada log com horário, serviço, rota (se houver) e trecho do conteúdo.
Para perguntas sim/não, responda com base nas evidências: confirme se houver logs que comprovem, negue se não houver.
Logs INFO com status 2xx indicam operações bem-sucedidas (ex.: transação criada com POST 201).
Se metrics.requestCount.count > 0, confirme a operação e cite os logs.
Nunca diga quantos logs existem sem listar ou descrever quando a pergunta pedir "quais" ou "houve".`,
      },
      {
        role: 'user',
        content: `Pergunta: ${question}\n\nDados:\n${context}`,
      },
    ]);

    const text =
      typeof response.content === 'string'
        ? response.content
        : JSON.stringify(response.content);
    const trimmed = text.trim();
    if (trimmed && (!hasEvidence || !isEmptyPeriodAnswer(trimmed))) {
      return trimmed;
    }
    return formatFallbackAnswer(question, metrics, evidence);
  }
}

function hasMetricsData(metrics: {
  failureCount?: FailureCountResult;
  topRoutes?: RouteFailureRow[];
  requestCount?: HttpRequestCountResult;
}): boolean {
  if (metrics.requestCount != null) return true;
  if (metrics.failureCount != null) return true;
  if (metrics.topRoutes && metrics.topRoutes.length > 0) return true;
  return false;
}

function isEmptyPeriodAnswer(text: string): boolean {
  return /n[aã]o\s+(h[aá]|houve|encontrei|foram)/i.test(text);
}

function noDataAnswer(question: string, plan: QueryPlan): string {
  if (/existe|há|houve|algum|alguma/i.test(question)) {
    return 'Não encontrei logs relevantes no período analisado.';
  }
  if (plan.filters.level === 'ERROR' || plan.aggregation === 'count_failures') {
    return 'Nenhum erro encontrado no período.';
  }
  return 'Nenhum log relevante encontrado no período.';
}

function formatEvidenceForContext(e: LogEvidence) {
  return {
    lokiTs: e.lokiTs,
    level: e.level,
    service: e.service,
    route: e.route,
    httpMethod: e.httpMethod,
    statusCode: e.statusCode,
    content: truncate(e.content, 300),
    score: e.score,
  };
}

function formatFallbackAnswer(
  question: string,
  metrics: {
    failureCount?: FailureCountResult;
    topRoutes?: RouteFailureRow[];
    requestCount?: HttpRequestCountResult;
  },
  evidence: LogEvidence[],
): string {
  if (metrics.requestCount) {
    const base =
      metrics.requestCount.count > 0
        ? `Sim, o endpoint ${metrics.requestCount.httpMethod} ${metrics.requestCount.route} foi chamado ${metrics.requestCount.count} vez(es) no período (${metrics.requestCount.since} a ${metrics.requestCount.until}).`
        : `Não, o endpoint ${metrics.requestCount.httpMethod} ${metrics.requestCount.route} não foi chamado no período (${metrics.requestCount.since} a ${metrics.requestCount.until}).`;
    if (evidence.length > 0) {
      return `${base}\n\n${formatEvidenceList(evidence)}`;
    }
    return base;
  }

  if (metrics.topRoutes?.length) {
    const lines = metrics.topRoutes.map(
      (r) =>
        `- ${r.httpMethod ? `${r.httpMethod} ` : ''}${r.route}: ${r.failures} falha(s)`,
    );
    return `Rotas com mais falhas:\n${lines.join('\n')}`;
  }

  const count = metrics.failureCount?.count;
  if (count === 0 && evidence.length === 0) {
    return 'Nenhum erro encontrado no período.';
  }

  if (evidence.length > 0) {
    const header =
      count != null
        ? `${count} erro(s) no período. Detalhes dos ${Math.min(evidence.length, 20)} mais recentes:`
        : `${evidence.length} log(s) relevante(s) no período:`;
    return `${header}\n\n${formatEvidenceList(evidence)}`;
  }

  if (count != null) {
    return `Foram registrados ${count} erro(s) no período, mas nenhum detalhe disponível.`;
  }

  if (/existe|há|houve|algum|alguma|problema/i.test(question)) {
    return 'Não encontrei evidências relevantes no período analisado.';
  }

  return 'Nenhum log relevante encontrado no período.';
}

function formatEvidenceList(evidence: LogEvidence[]): string {
  return evidence
    .slice(0, 20)
    .map((e) => {
      const route =
        e.httpMethod && e.route
          ? ` ${e.httpMethod} ${e.route}`
          : e.route
            ? ` ${e.route}`
            : '';
      const status = e.statusCode ? ` [${e.statusCode}]` : '';
      return `- [${e.lokiTs}] ${e.level} ${e.service}${route}${status}: ${truncate(e.content, 200)}`;
    })
    .join('\n');
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}
