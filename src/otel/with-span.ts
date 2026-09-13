import { Span, SpanStatusCode, trace } from '@opentelemetry/api';

const tracer = trace.getTracer(process.env.OTEL_SERVICE_NAME ?? 'app');

export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, (span) =>
    fn(span)
      .catch((error) => {
        span.recordException(error as Error);
        span.setStatus({ code: SpanStatusCode.ERROR });
        throw error;
      })
      .finally(() => {
        span.end();
      }),
  );
}
