# otel

Demo NestJS API (users and transactions) with full OpenTelemetry instrumentation and AI-powered log search. Prepared as the companion project for an **Eximia** blog post.

The stack ships traces, metrics, and logs through the OpenTelemetry Collector into Tempo and Loki, with Grafana for visualization. On top of that pipeline, a log embedder indexes Loki entries into PostgreSQL (pgvector), enabling semantic search and natural-language Q&A over application logs.

## Setup

Copy the environment template and set your OpenAI key:

```bash
cp .env.example .env
# edit .env and set OPENAI_API_KEY
```

Start the full stack:

```bash
docker compose up -d --build
```

The API runs in the `app` container with hot reload (`nest start --watch`). Changes under `src/` restart the process automatically.

To run the API outside Docker (logs will not reach Loki via Alloy):

```bash
npm install
docker compose up -d postgres otel-collector tempo loki alloy grafana prometheus log-embedder
npm run start:dev
```

Production image: `docker build -f Dockerfile -t otel-app .`

Swagger UI: [http://localhost:3001/doc](http://localhost:3001/doc)

## Commands

- `npm run start:dev` — development with watch
- `npm run start:prod` — production
- `npm run test` — unit tests
- `npm run test:e2e` — end-to-end tests
- `npm run embedder:dev` — run the log embedder locally (outside Docker)

## AI features

The AI layer turns raw logs into something you can search and ask questions about.

### Log embedder (`log-embedder`)

A background worker polls Loki, embeds log lines with OpenAI (`text-embedding-3-small` by default), and stores vectors in PostgreSQL via pgvector. It runs automatically as a Docker Compose service.

### Semantic log search — `GET /logs/search?q=...`

Finds log entries by meaning, not just keyword match. Returns the closest embedded log lines ranked by cosine similarity.

### Log Q&A — `POST /logs/ask`

Ask analytical questions in natural language, for example:

- "How many 5xx errors in the last hour?"
- "Which routes failed the most today?"

The pipeline combines:

1. **Query planner** — classifies the question (aggregate, semantic, or hybrid) and extracts time windows and filters.
2. **Analytics** — runs SQL aggregations on parsed HTTP log fields when the question calls for counts or rankings.
3. **RAG** — retrieves relevant embedded log lines via vector search.
4. **Answer synthesis** — an LLM (`gpt-4o-mini` by default) produces a grounded answer from metrics and evidence.

Both AI endpoints require `OPENAI_API_KEY`. Without it the API still serves users and transactions; only log search and Q&A are disabled.

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key (required for AI features) | — |
| `OPENAI_EMBEDDING_MODEL` | Embedding model for log indexing | `text-embedding-3-small` |
| `OPENAI_CHAT_MODEL` | Chat model for Q&A and query planning | `gpt-4o-mini` |
| `LOKI_URL` | Loki API URL (embedder) | `http://loki:3100` |
| `LOKI_QUERY` | LogQL selector for the embedder | `{source="alloy-otel"}` |
| `EMBED_POLL_INTERVAL_MS` | Embedder poll interval | `30000` |
| `EMBED_BATCH_SIZE` | Lines embedded per batch | `32` |
| `EMBED_LOOKBACK_HOURS` | Initial lookback on first run | `24` |

## Docker Compose

| Service | Purpose |
|---------|---------|
| `postgres` | Application database with pgvector (`eximia_otel`). Init script in `docker/init.sql`. Port 5432. |
| `app` | NestJS API with OpenTelemetry and AI endpoints. Port 3001. |
| `log-embedder` | Polls Loki, embeds logs, writes vectors to PostgreSQL. |
| `otel-collector` | Receives traces, metrics, and logs over OTLP (gRPC 4317, HTTP 4318); forwards traces to Tempo and logs to Loki. |
| `tempo` | Trace storage. OTLP on ports 3200 (HTTP) and 4317/4318. |
| `loki` | Log storage. API on port 3100. Receives logs via OTLP from the collector. |
| `alloy` | Collects container logs and ships them to Loki. |
| `grafana` | UI for traces (Tempo) and logs (Loki). Port 3000, anonymous auth enabled. |
| `prometheus` | Metrics storage. Port 9090. |

Postgres credentials (local dev only): user `admin`, password `123456`, database `eximia_otel`.

## YAML files in `docker/`

| File | Description |
|------|-------------|
| `otel-collector-config.yaml` | OpenTelemetry Collector config: OTLP receivers (gRPC/HTTP) and pipelines routing traces to Tempo and logs to Loki. |
| `tempo-config.yaml` | Grafana Tempo config: server, OTLP receiver, ingester, compactor, and local storage at `/tmp/tempo`. |
| `loki-config.yaml` | Loki config: server, filesystem storage, schema, and query cache. |
| `alloy-config.alloy` | Grafana Alloy config: Docker log discovery and forwarding to Loki. |
| `prometheus.yml` | Prometheus scrape config for collector metrics. |
| `grafana/provisioning/datasources/datasources.yaml` | Grafana datasource provisioning: Tempo and Loki with traces-to-logs linking. |
