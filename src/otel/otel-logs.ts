import { logs, SeverityNumber } from '@opentelemetry/api-logs';

export function emitOtelLog(
  severityNumber: SeverityNumber,
  severityText: string,
  body: string,
  contextName?: string,
): void {
  if (process.env.OTEL_LOGS_EXPORTER === 'none') return;
  logs.getLogger('nestjs').emit({
    severityNumber,
    severityText,
    body,
    attributes: contextName ? { 'log.context': contextName } : undefined,
  });
}
