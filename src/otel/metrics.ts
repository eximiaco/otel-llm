import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter(process.env.OTEL_SERVICE_NAME ?? 'app');

export const usersCreatedCounter = meter.createCounter('users.created', {
  description: 'Total de usuários criados',
});

export const transactionsCreatedCounter = meter.createCounter(
  'transactions.created',
  {
    description: 'Total de transações criadas',
  },
);
