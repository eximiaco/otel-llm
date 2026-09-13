import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import type {
  Aggregation,
  PlannerMode,
  QueryPlan,
  QueryPlanFilters,
  TimeUnit,
} from './query-plan.types';

const PLANNER_SCHEMA = `{
  "mode": "aggregate" | "rag" | "hybrid" | "unsupported",
  "timeWindow": { "amount": number, "unit": "minute" | "hour" | "day", "calendarDay": boolean (opcional, true para "hoje") },
  "filters": { "level": "ERROR" (opcional), "route": "/users" (só path), "httpMethod": "GET" },
  "aggregation": "count_failures" | "top_route_by_count" | "count_http_requests" | "none",
  "listLogs": boolean,
  "limit": number,
  "ragQuery": string (opcional),
  "unsupportedReason": string (obrigatório quando mode="unsupported")
}`;

const PLANNER_PROMPT = `Você planeja consultas sobre logs. Analise a intenção da pergunta e responda APENAS com JSON válido neste schema:
${PLANNER_SCHEMA}

Dados disponíveis:
- conteúdo textual de cada mensagem de log;
- horário, serviço, nível, traceId, rota HTTP, método HTTP e status;
- contagens e rankings calculados sobre esses campos.

Dados que NÃO estão disponíveis:
- corpo da requisição;
- corpo da resposta;
- valor retornado por um endpoint, exceto quando estiver escrito explicitamente em uma mensagem de log;
- estado interno da aplicação que não tenha sido registrado.

Modos:
- aggregate: contagem ou ranking resolvido pelos campos estruturados;
- rag: busca semântica por um tema presente no conteúdo dos logs;
- hybrid: agregação combinada com evidências dos logs;
- unsupported: a pergunta depende de dados que não são registrados ou não pode ser respondida pelas operações disponíveis.

Regras:
- Classifique como unsupported quando a pergunta depender de request body, response body, payload ou valor retornado e essa informação não estiver explicitamente nos logs.
- Para unsupported, use aggregation="none", listLogs=false, filters={} e explique objetivamente a limitação em unsupportedReason.
- Não invente ou deduza uma rota que não tenha sido escrita na pergunta.
- Uma palavra como "consulta", "usuário" ou "resposta" não representa, por si só, uma rota.
- Use listLogs=true somente quando a pergunta solicitar evidências ou quando elas forem necessárias para uma resposta qualitativa.
- Use filters.level="ERROR" somente quando a pergunta tratar de erros ou falhas.
- "hoje" representa timeWindow com amount=1, unit="day" e calendarDay=true.
- count_http_requests exige httpMethod e route explícitos.
- count_failures e top_route_by_count são exclusivos de perguntas sobre falhas.
- Quando não houver período explícito, use a última hora.`;

const MODES: PlannerMode[] = ['aggregate', 'rag', 'hybrid', 'unsupported'];
const AGGREGATIONS: Aggregation[] = [
  'count_failures',
  'top_route_by_count',
  'count_http_requests',
  'none',
];
const TIME_UNITS: TimeUnit[] = ['minute', 'hour', 'day'];

@Injectable()
export class QueryPlannerService {
  private readonly chat: ChatOpenAI | null;

  constructor() {
    const apiKey = process.env.OPENAI_API_KEY;
    this.chat = apiKey
      ? new ChatOpenAI({
          apiKey,
          model: process.env.OPENAI_CHAT_MODEL ?? 'gpt-4o-mini',
          temperature: 0,
        })
      : null;
  }

  async plan(question: string): Promise<QueryPlan> {
    if (!this.chat) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY is required for query planning',
      );
    }

    try {
      const response = await this.chat.invoke([
        { role: 'system', content: PLANNER_PROMPT },
        { role: 'user', content: question },
      ]);
      const text =
        typeof response.content === 'string'
          ? response.content
          : JSON.stringify(response.content);
      return normalizePlan(parseJsonResponse(text));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException('Não foi possível planejar a consulta');
    }
  }
}

function parseJsonResponse(text: string): unknown {
  const trimmed = text.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new BadGatewayException(
      'O planner não retornou um plano JSON válido',
    );
  }

  try {
    return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
  } catch {
    throw new BadGatewayException(
      'O planner não retornou um plano JSON válido',
    );
  }
}

function normalizePlan(value: unknown): QueryPlan {
  if (!isRecord(value)) {
    throw new BadGatewayException('O planner retornou um plano inválido');
  }

  const mode = value.mode;
  const aggregation = value.aggregation;
  if (!isOneOf(mode, MODES) || !isOneOf(aggregation, AGGREGATIONS)) {
    throw new BadGatewayException(
      'O planner retornou um modo ou agregação inválidos',
    );
  }

  const timeWindow = normalizeTimeWindow(value.timeWindow);
  const filters = normalizeFilters(value.filters);
  const limit =
    typeof value.limit === 'number' && Number.isFinite(value.limit)
      ? Math.max(1, Math.min(Math.trunc(value.limit), 50))
      : 10;

  if (mode === 'unsupported') {
    const unsupportedReason =
      typeof value.unsupportedReason === 'string'
        ? value.unsupportedReason.trim()
        : '';
    if (!unsupportedReason) {
      throw new BadGatewayException(
        'O planner não explicou por que a consulta não é suportada',
      );
    }
    return {
      mode,
      timeWindow,
      filters: {},
      aggregation: 'none',
      listLogs: false,
      limit,
      unsupportedReason,
    };
  }

  if (
    aggregation === 'count_http_requests' &&
    (!filters.route || !filters.httpMethod)
  ) {
    throw new BadGatewayException(
      'O planner não informou método e rota para contar requisições',
    );
  }

  return {
    mode,
    timeWindow,
    filters,
    aggregation,
    listLogs: value.listLogs === true,
    limit,
    ragQuery:
      typeof value.ragQuery === 'string' && value.ragQuery.trim()
        ? value.ragQuery.trim()
        : undefined,
  };
}

function normalizeTimeWindow(value: unknown): QueryPlan['timeWindow'] {
  if (!isRecord(value)) {
    throw new BadGatewayException('O planner não informou a janela temporal');
  }

  const amount = value.amount;
  const unit = value.unit;
  if (
    typeof amount !== 'number' ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    !isOneOf(unit, TIME_UNITS)
  ) {
    throw new BadGatewayException(
      'O planner informou uma janela temporal inválida',
    );
  }

  return {
    amount,
    unit,
    calendarDay: value.calendarDay === true,
  };
}

function normalizeFilters(value: unknown): QueryPlanFilters {
  if (!isRecord(value)) return {};

  return {
    level: optionalString(value.level)?.toUpperCase(),
    route: normalizeRoute(optionalString(value.route)),
    httpMethod: optionalString(value.httpMethod)?.toUpperCase(),
  };
}

function normalizeRoute(route: string | undefined): string | undefined {
  if (!route) return undefined;
  const withoutQuery = route.trim().split('?')[0];
  if (!withoutQuery.startsWith('/')) {
    throw new BadGatewayException('O planner informou uma rota inválida');
  }
  return withoutQuery;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isOneOf<T extends string>(value: unknown, options: T[]): value is T {
  return typeof value === 'string' && options.includes(value as T);
}
