import { trace } from '@opentelemetry/api';
import { SeverityNumber } from '@opentelemetry/api-logs';
import { ConsoleLogger } from '@nestjs/common';
import { emitOtelLog } from './otel-logs';

function getTraceId(): string {
  const span = trace.getActiveSpan();
  return span?.spanContext().traceId ?? '';
}

export class TraceLogger extends ConsoleLogger {
  formatLine(level: string, message: string, context?: string): string {
    const traceId = getTraceId();
    const ctx = context ?? this.context ?? '';
    const tracePart = traceId ? ` [trace_id=${traceId}]` : '';
    return `${level.toUpperCase()}${tracePart} ${ctx} - ${message}`;
  }

  private write(
    level: string,
    severityNumber: SeverityNumber,
    message: string,
    context?: string,
  ): void {
    const line = this.formatLine(level, message, context);
    process.stdout.write(line + '\n');
    emitOtelLog(severityNumber, level.toUpperCase(), line, context);
  }

  log(message: string, context?: string): void {
    this.write('info', SeverityNumber.INFO, message, context);
  }

  error(message: string, stack?: string, context?: string): void {
    this.write('error', SeverityNumber.ERROR, message, context);
    if (stack) process.stdout.write(stack + '\n');
  }

  warn(message: string, context?: string): void {
    this.write('warn', SeverityNumber.WARN, message, context);
  }

  debug(message: string, context?: string): void {
    this.write('debug', SeverityNumber.DEBUG, message, context);
  }

  verbose(message: string, context?: string): void {
    this.write('verbose', SeverityNumber.TRACE, message, context);
  }
}
