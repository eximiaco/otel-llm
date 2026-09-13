import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import {
  defaultResource,
  resourceFromAttributes,
} from '@opentelemetry/resources';

const endpoint =
  process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
const baseUrl = endpoint
  .replace(/\/v1\/(traces|metrics|logs)$/, '')
  .replace(/\/$/, '');
const tracesUrl = endpoint.endsWith('/v1/traces')
  ? endpoint
  : `${baseUrl}/v1/traces`;
const metricsUrl = endpoint.endsWith('/v1/metrics')
  ? endpoint
  : `${baseUrl}/v1/metrics`;
const logsUrl = endpoint.endsWith('/v1/logs') ? endpoint : `${baseUrl}/v1/logs`;
const tracesExporter =
  process.env.OTEL_TRACES_EXPORTER === 'none' ? undefined : 'otlp';
const logsExporter =
  process.env.OTEL_LOGS_EXPORTER === 'none' ? undefined : 'otlp';

const serviceName = process.env.OTEL_SERVICE_NAME ?? 'app';
const resource = defaultResource().merge(
  resourceFromAttributes({ 'service.name': serviceName }),
);

const sdk = new NodeSDK({
  resource,
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors:
    tracesExporter === 'otlp'
      ? [new BatchSpanProcessor(new OTLPTraceExporter({ url: tracesUrl }))]
      : undefined,
  metricReaders: [
    new PeriodicExportingMetricReader({
      exporter: new OTLPMetricExporter({ url: metricsUrl }),
      exportIntervalMillis: 15000,
    }),
  ],
  logRecordProcessors:
    logsExporter === 'otlp'
      ? [new BatchLogRecordProcessor(new OTLPLogExporter({ url: logsUrl }))]
      : undefined,
});

sdk.start();
