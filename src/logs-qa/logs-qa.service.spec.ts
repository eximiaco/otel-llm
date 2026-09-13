import { LogAnalyticsRepository } from './log-analytics.repository';
import { LogRagService } from './log-rag.service';
import { LogsAnswerService } from './logs-answer.service';
import { LogsQaService } from './logs-qa.service';
import { QueryPlannerService } from './query-planner.service';

describe('LogsQaService', () => {
  const originalApiKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalApiKey;
    }
  });

  it('returns the planner limitation without querying logs', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    const planner = {
      plan: jest.fn().mockResolvedValue({
        mode: 'unsupported',
        timeWindow: { amount: 1, unit: 'hour' },
        filters: {},
        aggregation: 'none',
        listLogs: false,
        limit: 10,
        unsupportedReason: 'O corpo da resposta não é registrado nos logs.',
      }),
    } as unknown as QueryPlannerService;
    const countFailures = jest.fn();
    const topRoutesByFailures = jest.fn();
    const countHttpRequests = jest.fn();
    const retrieve = jest.fn();
    const synthesize = jest.fn();
    const analytics = {
      countFailures,
      topRoutesByFailures,
      countHttpRequests,
    } as unknown as LogAnalyticsRepository;
    const rag = { retrieve } as unknown as LogRagService;
    const answer = { synthesize } as unknown as LogsAnswerService;
    const service = new LogsQaService(planner, analytics, rag, answer);

    const result = await service.ask(
      'Quantas requisições responderam com Hello World!?',
    );

    expect(result.answer).toBe(
      'Não é possível responder a essa consulta com os logs disponíveis. O corpo da resposta não é registrado nos logs.',
    );
    expect(countFailures).not.toHaveBeenCalled();
    expect(topRoutesByFailures).not.toHaveBeenCalled();
    expect(countHttpRequests).not.toHaveBeenCalled();
    expect(retrieve).not.toHaveBeenCalled();
    expect(synthesize).not.toHaveBeenCalled();
  });
});
