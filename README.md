# StaySync — Hotel Offer Orchestrator

StaySync is a hotel offer aggregation service built as a production-style take-home assignment. It calls two mocked hotel supplier APIs in **parallel** using a **Temporal.io** workflow, deduplicates hotels by `name`, keeps the cheapest offer per hotel, persists the deduplicated results to **Redis** in a **Sorted Set**, and serves them with **price-range filtering performed inside Redis**.

---

## Overview

```
GET /api/hotels?city=delhi
        |
        v
Express Controller
        |
        v
Temporal Client  (starts HotelAggregationWorkflow)
        |
        v
Hotel Aggregation Workflow
        |
        +---------------------+
        |                     |
        v                     v
Supplier A Activity    Supplier B Activity   (concurrent)
        |                     |
        +----------+----------+
                   |
                   v
          Deduplication (by name)
                   |
                   v
        Cheapest Offer / Tie-breaker
                   |
                   v
       Redis Activity (Sorted Set: hotels:{city})
                   |
                   v
       Redis Price Filtering (ZRANGEBYSCORE)
                   |
                   v
              JSON Response
```

Example response for `GET /api/hotels?city=delhi`:

```json
[
  {
    "name": "Holtin",
    "price": 5340,
    "supplier": "Supplier B",
    "commissionPct": 20
  },
  {
    "name": "Radison",
    "price": 5900,
    "supplier": "Supplier A",
    "commissionPct": 13
  }
]
```

---

## Features

- **Temporal orchestration** — a real Temporal workflow that calls both suppliers concurrently as activities.
- **Deduplication** — hotels appearing in both suppliers are merged by `name`; the cheaper price wins.
- **Deterministic tie-breaker** — on equal prices **Supplier A** wins.
- **Supplier failure resilience** — if one supplier fails after retries, the workflow still returns the healthy supplier's offers.
- **Redis persistence** — deduplicated results are stored in a Redis Sorted Set keyed by `hotels:{city}` with `score = price`.
- **Redis-native price filtering** — price ranges are applied with `ZRANGEBYSCORE`; no Node-side filtering.
- **Stale-data safety** — the sorted set key is deleted before each write, so repeated executions never accumulate duplicate/stale entries.
- **Mock suppliers** — two in-app endpoints (`/supplierA/hotels`, `/supplierB/hotels`) with overlapping datasets.
- **Validation** — rejects missing city, invalid/negative prices, and inverted price ranges with HTTP 400.
- **Centralized error handling** — consistent `{ "error": "..." }` shapes, no stack traces leaked.
- **Logging** — Winston-based logs for requests, workflow lifecycle, supplier calls, dedup, Redis writes/queries, and errors (including request method/path/status/duration).
- **Health checks** — `/health` performs lightweight live checks against Redis, Temporal, and both suppliers, summarized under a `services` map.
- **Docker Compose** — one command brings up the API, worker, Redis, Temporal server, and Temporal UI.
- **Testing** — Jest unit + API tests covering dedup, tie-breaking, Redis range behavior, and HTTP validation.
- **Postman collection** — pre-built requests for every endpoint and error case.

---

## Tech Stack

| Component      | Technology                                  |
| -------------- | ------------------------------------------- |
| Language       | TypeScript (strict mode)                    |
| API            | Node.js + Express                           |
| Orchestration  | Temporal.io (workflow + activities)         |
| Storage        | Redis (Sorted Sets) via ioredis             |
| HTTP client    | Axios (activity → supplier calls)           |
| Logging        | Winston                                     |
| Testing        | Jest + ts-jest + Supertest                  |
| Containers     | Docker, Docker Compose                      |
| API tooling    | Postman                                     |

---

## Project Structure

```
staysync/
│
├── src/
│   ├── api/
│   │   ├── controllers/
│   │   │   └── hotel.controller.ts     # validation + aggregation handler
│   │   ├── routes/
│   │   │   ├── hotel.routes.ts         # GET /api/hotels
│   │   │   ├── supplier.routes.ts      # createSupplierRouter factory (A + B)
│   │   │   └── health.routes.ts        # GET /health (thin wrapper)
│   │   └── app.ts                      # Express app + centralized errors
│   │
│   ├── temporal/
│   │   ├── workflows/
│   │   │   └── hotel.workflow.ts       # hotelAggregationWorkflow
│   │   ├── activities/
│   │   │   ├── supplier.activities.ts  # fetchSupplierA / fetchSupplierB
│   │   │   └── redis.activities.ts     # saveHotelsToRedis / queryHotelsFromRedis
│   │   ├── client.ts                   # lazily-connected Temporal client
│   │   └── worker.ts                   # Temporal worker bootstrap
│   │
│   ├── services/
│   │   ├── aggregation.service.ts      # API → Temporal workflow invocation
│   │   ├── hotel.service.ts            # pure dedup + best-offer logic
│   │   ├── redis.service.ts            # Redis sorted-set save + range query
│   │   ├── health.service.ts           # live dependency checks + summary
│   │   └── supplier.service.ts         # mock supplier dataset lookups
│   │
│   ├── suppliers/
│   │   ├── supplierA.ts                # Supplier A static dataset
│   │   └── supplierB.ts                # Supplier B static dataset
│   │
│   ├── types/
│   │   ├── hotel.ts                    # shared domain types
│   │   └── health.ts                   # health check types
│   ├── utils/
│   │   └── logger.ts                   # Winston logger
│   ├── config/
│   │   └── env.ts                      # environment configuration
│   └── server.ts                       # HTTP server bootstrap
│
├── tests/
│   ├── hotel.service.test.ts           # dedup / tie-breaker / single-supplier
│   ├── redis.service.test.ts           # sorted set save + range behavior
│   ├── health.service.test.ts          # health summary logic
│   └── api.test.ts                     # validation + HTTP status codes
│
├── postman/
│   └── staysync.postman_collection.json
│
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── .env.example
├── .gitignore
└── README.md
```

---

## Prerequisites

- **Docker** (with Docker Compose / `docker compose` v2) — recommended for local runs
- **Node.js 20+** and **npm** — only required for running locally without Docker
- **Postman** — optional, for testing the API
- **Redis** and **Temporal** — provided automatically by Docker Compose

---

## Environment Variables

All configuration is read from environment variables (see `.env.example`).

| Variable          | Default             | Description                                  |
| ----------------- | ------------------- | -------------------------------------------- |
| `PORT`            | `3000`              | HTTP port for the API                         |
| `REDIS_HOST`      | `localhost`         | Redis host                                    |
| `REDIS_PORT`      | `6379`              | Redis port                                    |
| `TEMPORAL_ADDRESS`| `localhost:7233`    | Temporal gRPC address (`host:port`)           |
| `TEMPORAL_NAMESPACE` | `default`        | Temporal namespace                            |
| `TEMPORAL_TASK_QUEUE` | `hotel-aggregation` | Task queue used for the workflow          |
| `SUPPLIER_A_URL`  | `http://localhost:3000` | Base URL of the mock Supplier A endpoint   |
| `SUPPLIER_B_URL`  | `http://localhost:3000` | Base URL of the mock Supplier B endpoint   |
| `SIMULATE_SUPPLIER_A_FAILURE` | `false` | Set to `true` to make Supplier A return `503` (failure simulation) |
| `SIMULATE_SUPPLIER_B_FAILURE` | `false` | Set to `true` to make Supplier B return `503` (failure simulation) |
| `LOG_LEVEL`       | `info`              | Winston log level                             |

> Temporal also supports the legacy split `TEMPORAL_HOST` + `TEMPORAL_PORT` vars; when `TEMPORAL_ADDRESS` is unset and either is present, the address is derived from them.

> In Docker Compose, `SUPPLIER_A_URL` and `SUPPLIER_B_URL` point at `http://api:3000` (the Compose service name), so the worker reaches the in-app mock suppliers over the Compose network.

No secrets are committed. Copy `.env.example` to `.env` only if you run without Docker.

---

## Local Setup (without Docker)

Requires a running Redis and Temporal server. For Temporal, the simplest option is:

```bash
docker run --name temporal-dev -p 7233:7233 temporalio/admin-tools:1.22.4 temporal server start-dev --ip 0.0.0.0
```

Then:

```bash
npm install
npm run build

# terminal 1 — API server
npm start

# terminal 2 — Temporal worker
npm run start:worker
```

For local runs, edit `.env` (or environment) to point at your local services:

```
REDIS_HOST=localhost
TEMPORAL_ADDRESS=localhost:7233
SUPPLIER_A_URL=http://localhost:3000
SUPPLIER_B_URL=http://localhost:3000
```

---

## Docker Setup

The whole stack — API, Temporal worker, Redis, Temporal server, and Temporal UI — starts with one command:

```bash
docker compose up --build
```

Services:

| Service       | Purpose                                      | Port   |
| ------------- | -------------------------------------------- | ------ |
| `api`         | Express server (also hosts mock suppliers)   | `3000` |
| `worker`      | Temporal worker executing the workflow       | —      |
| `redis`       | Sorted-set storage                           | `6379` |
| `temporal`    | Temporal dev server (SQLite, auto-setup)     | `7233` |
| `temporal-ui` | Temporal web UI                              | `8080` |

The API and worker share the same application image; Compose `depends_on` + health checks ensure Redis and Temporal are healthy before they start. The API service runs a `/health`-based health check with `restart: unless-stopped` on both services for resilience.

Once up:

- API: http://localhost:3000
- Temporal UI: http://localhost:8080

Stop everything with:

```bash
docker compose down
```

---

## API Documentation

### `GET /api/hotels`

Aggregates offers from both suppliers via the Temporal workflow, deduplicates, persists to Redis, and returns the result.

| Query param | Type     | Required | Description                            |
| ----------- | -------- | -------- | -------------------------------------- |
| `city`      | string   | yes      | City to search (case-insensitive)      |
| `minPrice`  | number   | no       | Lower price bound (inclusive)          |
| `maxPrice`  | number   | no       | Upper price bound (inclusive)          |

Returns an array of `Hotel Result` objects:

```json
[
  {
    "name": "Holtin",
    "price": 5340,
    "supplier": "Supplier B",
    "commissionPct": 20
  }
]
```

| Status | Condition                                        |
| ------ | ------------------------------------------------ |
| `200`  | Success                                          |
| `400`  | Missing/invalid `city`, invalid/negative price, or `minPrice > maxPrice` |
| `500`  | Unexpected server failure                        |

### `GET /supplierA/hotels?city=delhi`

Mock Supplier A endpoint. Returns `HotelOffer[]` for the requested city from Supplier A's static dataset. Returns `503` when `SIMULATE_SUPPLIER_A_FAILURE=true`.

### `GET /supplierB/hotels?city=delhi`

Mock Supplier B endpoint. Returns `HotelOffer[]` for the requested city from Supplier B's static dataset. Returns `503` when `SIMULATE_SUPPLIER_B_FAILURE=true`.

### `GET /health`

Performs live checks against Redis, Temporal, and both mock suppliers, then summarizes them under a `services` map.

```json
{
  "status": "ok",
  "services": {
    "app": "healthy",
    "supplierA": "healthy",
    "supplierB": "healthy",
    "redis": "healthy",
    "temporal": "healthy"
  }
}
```

Returns `200` when every service is `healthy`, and `503` when any dependency is degraded or down (overall `status` is `degraded` when a subset is unhealthy and `down` when all are unhealthy).

---

## Example Requests (curl)

```bash
# Normal aggregation
curl "http://localhost:3000/api/hotels?city=delhi"

# Price filtering (min 5000, max 6000)
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=5000&maxPrice=6000"

# City with no results
curl "http://localhost:3000/api/hotels?city=mumbai"

# Missing city → 400
curl "http://localhost:3000/api/hotels"

# Invalid price → 400
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=abc"

# Inverted price range → 400
curl "http://localhost:3000/api/hotels?city=delhi&minPrice=7000&maxPrice=5000"

# Health
curl "http://localhost:3000/health"

# Mock suppliers
curl "http://localhost:3000/supplierA/hotels?city=delhi"
curl "http://localhost:3000/supplierB/hotels?city=delhi"
```

---

## Redis Design

- **Data structure:** Sorted Set.
- **Key:** `hotels:{city}` (city lowercased), e.g. `hotels:delhi`.
- **Score:** hotel `price`.
- **Member:** JSON-serialized offer.

```text
Key:   hotels:delhi
Score: 5340
Member: {"name":"Holtin","price":5340,"supplier":"Supplier B","commissionPct":20,"originalId":"b1","city":"delhi"}
```

**Write path** (Temporal activity `saveHotelsToRedis`):

1. `DEL hotels:{city}` — removes any stale set from a previous execution.
2. `ZADD` each deduplicated offer in a transaction (pipeline).

**Query path** (Temporal activity `queryHotelsFromRedis`):

- No price range → `ZRANGE hotels:{city} 0 -1`
- With price range → `ZRANGEBYSCORE hotels:{city} <min> <max>`, using `-inf` / `+inf` for open bounds.

Because the score is the price, `ZRANGEBYSCORE` performs filtering entirely inside Redis. No hotel list is read into Node.js and filtered in JavaScript.

Note: Redis returns range results ordered by score ascending. The API intentionally returns them in that order; see Assumptions.

---

## Temporal Design

- **Workflow:** `hotelAggregationWorkflow(input)` in `src/temporal/workflows/hotel.workflow.ts`.
- **Task queue:** `hotel-aggregation`.
- **Activities:**
  - `fetchSupplierA(city)` — HTTP GET to the Supplier A mock.
  - `fetchSupplierB(city)` — HTTP GET to the Supplier B mock.
  - `saveHotelsToRedis(city, offers)` — sorted-set write.
  - `queryHotelsFromRedis(city, minPrice?, maxPrice?)` — sorted-set range query.

**Concurrency & determinism:**

- Both supplier activities run in parallel with `Promise.all` (see `hotel.workflow.ts`).
- All external I/O happens only inside activities; the workflow performs no direct network, filesystem, or Redis calls. Deduplication is a pure, deterministic function.
- Supplied activity options: `startToCloseTimeout: "10 seconds"` and a `retry` policy (`maximumAttempts: 2`, `initialInterval: "1 second"`, exponential backoff).

**Failure handling (see below)** and **Redis writes** are explicit, ordered workflow steps, so history replays deterministically.

---

## Failure Handling

**Partial supplier failure:**

Each supplier call is wrapped so that a failure does not abort the workflow:

```ts
try {
  return await promise;
} catch (error) {
  // log + return []
}
```

Both activities still run concurrently. If Supplier A is down after its retries, the workflow logs the failure, uses an empty Supplier A result, and still returns Supplier B's valid offers (and vice versa). A total failure (both suppliers down, or Redis unavailable) surfaces as an HTTP 500.

To exercise this live, restart the `api` service with `SIMULATE_SUPPLIER_A_FAILURE=true` (or B) and call `/api/hotels` — the healthy supplier's offers are still returned (`/health` also reports the simulated supplier as `unhealthy`). With Docker Compose the flag is interpolated, so:

```bash
# Linux/macOS
SIMULATE_SUPPLIER_A_FAILURE=true docker compose up -d api

# Windows PowerShell
$env:SIMULATE_SUPPLIER_A_FAILURE="true"; docker compose up -d api

# restore (default false)
docker compose up -d api
```

**Redis failure** aborts the workflow and yields HTTP 500 (offers cannot be served without persistence/filtering).

**API errors:** the centralized Express error middleware returns `{ "error": "..." }` with an appropriate status code and never exposes stack traces.

---

## Testing

```bash
npm test
```

Coverage includes:

- **Deduplication:** cheaper price wins when a hotel exists in both suppliers.
- **Intra-supplier dedup:** when a single supplier returns duplicate names, the cheapest quote is kept.
- **Single-supplier offers:** Supplier A-only and Supplier B-only hotels are retained.
- **Tie-breaking:** Supplier A wins on equal prices.
- **Empty results:** both suppliers empty → `[]`.
- **Redis behavior:** `DEL` before write, `score = price`, lowercased keys, `ZRANGEBYSCORE` for ranges, `-inf`/`+inf` open bounds.
- **Health summary:** `ok` / `degraded` / `down` aggregation logic.
- **HTTP validation:** missing city, invalid/negative prices, inverted range → `400`; success → `200`; unexpected failure → `500` (no stack leak).
- **Health endpoint:** `200` when healthy, `503` with `degraded` status when a dependency is down.
- **Supplier endpoints:** per-city filtering and `400` for missing city.
- **Supplier failure simulation:** `503` behavior when the simulation flags are enabled.
- **404 handling** for unknown routes.

---

## Postman

1. Open Postman.
2. `Import` → select `postman/staysync.postman_collection.json`.
3. The collection defines a `{{baseUrl}}` variable (default `http://localhost:3000`); edit it in the collection's Variables tab if your API is elsewhere.

The collection includes: normal aggregation, price filtering, no-result city, missing city, invalid price, invalid price range, health, both mock supplier endpoints, and supplier failure simulation. Restart the API with `SIMULATE_SUPPLIER_A_FAILURE=true` (or B) — see the Failure Handling section — to see the failure-simulation responses.

---

## Assumptions

- **Tie-breaker:** when both suppliers quote the same price, **Supplier A wins** (deterministic, documented, and unit-tested).
- **Ordering:** Redis `ZRANGE`/`ZRANGEBYSCORE` return members ordered by score ascending; the API returns that order without additional sorting. (A stable, documented ordering avoids non-determinism.)
- **Supplier failure semantics:** a supplier that fails after retries is treated as returning zero offers rather than failing the whole request; at least one working supplier is needed for a successful response.
- **Cities are case-insensitive** for both lookup and the Redis key.
- **Redis key hygiene:** each workflow execution deletes and rewrites `hotels:{city}`, guaranteeing the set matches the latest aggregation (no stale or duplicated members).
- **Mock suppliers are served in-process** by the Express application; the worker reaches them through `SUPPLIER_A_URL`/`SUPPLIER_B_URL` over the Compose network.
- **Temporal dev server** uses SQLite (in-memory) persistence for this assignment; swap in Postgres/MySQL + Elasticsearch for durable production deployments.
- Only the scalar output shape (`name`, `price`, `supplier`, `commissionPct`) is returned by the API; the full offer (including `originalId`, `city`) is kept in the Redis member for debugging/inspection.