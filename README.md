# EventBoard Microservices API

A production-ready microservices platform demonstrating enterprise patterns:
- **Microservices Architecture**: Gateway, Auth Service, Events Service
- **Resilience**: Timeout and retry strategies with exponential backoff
- **Observability**: Correlation IDs for distributed request tracing
- **Idempotency**: Duplicate request handling for command safety
- **Multi-tenancy**: Organization-based data isolation
- **One-Command Deployment**: Docker Compose for local development

## Prerequisites

- **Docker** (v20+)
- **Docker Compose** (v2+)
- Node.js >= 18 (for local development)
- npm >= 9 (for local development)

## Quick Start (One Command)

```bash
docker-compose up
```

This starts:
- PostgreSQL database (port 5433)
- Auth Service (port 3002, TCP)
- Events Service (port 3001, TCP)
- API Gateway (port 3000, HTTP)

API available at: `http://localhost:3000/api/v1`

**All services** ready in ~15-20 seconds with health checks.

## Documentation

This project includes comprehensive documentation:

- **[SETUP.md](./docs/SETUP.md)** - Installation, configuration, and local deployment
- **[ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - System design, patterns, and data flow
- **[API.md](./docs/API.md)** - Complete API endpoint documentation with examples
- **[RUNBOOK.md](./docs/RUNBOOK.md)** - Operational procedures and troubleshooting
- **[DEMO.md](./docs/DEMO.md)** - Demo script and testing checklist

## Key Features

### Production-Ready Resilience
- **Timeout & Retry**: 3 automatic retries with exponential backoff (100ms → 200ms → 400ms)
- **Timeout**: 5-second timeout per RPC call prevents hanging requests
- Transparent to clients; only final result is shown

### Distributed Observability
- **Correlation IDs**: Unique request ID (`x-request-id`) propagated across all services
- **Structured Logging**: Pino JSON logging with correlation context
- **Request Tracing**: Follow a single request through all microservices

### Idempotency & Safety
- **Duplicate Protection**: Same `Idempotency-Key` + same data = guaranteed same result
- **In-Memory Cache**: 24-hour TTL (production: use Redis)
- **Safe Retries**: Retries won't cause duplicate database entries

### Multi-Tenancy
- **Organization Isolation**: Users see only their organization's data
- **Ownership-Based Access**: Resources protected by creator verification
- **Automatic Scoping**: Organization ID injected from JWT token

## Available Scripts

```bash
# Docker (recommended)
docker-compose up              # Start all services
docker-compose down            # Stop all services
docker-compose logs -f         # View logs

# Development (local)
npm run build                  # Compile TypeScript
npm run start:dev              # Watch mode (requires local DB)
npm run start:auth             # Auth service only
npm run start:events           # Events service only
npm run start:gateway          # Gateway only

# Database
npm run db:seed                # Populate sample data
npm run db:reset               # Clear and reseed

# Testing & Quality
npm run test                   # Unit tests
npm run test:e2e               # End-to-end tests
npm run test:smoke             # Microservices tests
npm run lint                   # ESLint
npm run format                 # Prettier
```

## Architecture Overview

```
┌──────────────┐
│    Client    │
└──────┬───────┘
       │ HTTP/REST
       ▼
┌────────────────────────────┐
│  API Gateway (port 3000)   │ ← Correlation IDs
│  ├─ Timeout & Retry       │    Idempotency
│  └─ Auth Validation        │    Request Routing
└──┬──────────────┬──────────┘
   │ TCP/RPC      │ TCP/RPC
   ▼              ▼
┌─────────────┐ ┌──────────────┐
│Auth Service │ │Events Service│
│ (3002)      │ │   (3001)     │
└─────┬───────┘ └──────┬───────┘
      │                │
      └────────┬───────┘
               ▼
        ┌─────────────┐
        │ PostgreSQL  │
        │  (5433)     │
        └─────────────┘
```

## Health Check

```bash
# Check API Gateway
curl http://localhost:3000/api/v1/health

# Check Database
docker-compose exec postgres pg_isready -U admin

# View all services
docker-compose ps
```

## Example Requests

### Login
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Create Event (with Idempotency)
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: create-event-123" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tech Conference",
    "startDate": "2024-03-15T09:00:00Z",
    "endDate": "2024-03-15T17:00:00Z"
  }'
```

### Trace Request
```bash
# Request with custom correlation ID
curl -H "x-request-id: trace-abc123" \
  http://localhost:3000/api/v1/events

# View logs for that request
docker-compose logs | grep trace-abc123
```

## Day 14: Microservices Realities + Production Readiness

This release implements:

✅ **Timeouts + Retry Strategy**
- Gateway calls timeout after 5 seconds
- Automatic retry with exponential backoff
- 3 retry attempts before failing

✅ **Idempotency Example**
- Command handlers with duplicate detection
- In-memory cache for idempotent requests
- Example: Create event safely with retries

✅ **Correlation ID Propagation**
- Unique request ID generated for each request
- Propagated across all service calls
- Included in all logs for tracing

✅ **System Runs with One Command**
```bash
docker-compose up
# All services start automatically in correct order
```

✅ **Logs Correlate Across Services**
- Filter logs by correlation ID to trace request
- See entire request flow: Gateway → Auth/Events → DB

✅ **Complete Documentation**
- Setup guide for deployment
- Architecture documentation
- Full API reference
- Operational runbook
- Demo and testing guide

## Project Structure

```
├── docker-compose.yml        # Local orchestration
├── Dockerfile               # Gateway service
├── Dockerfile.auth          # Auth service
├── Dockerfile.events        # Events service
│
├── src/
│   ├── gateway/            # API Gateway (HTTP entry point)
│   │   ├── gateway.service.ts  (with retry logic)
│   │   └── gateway.controller.ts (propagates correlation IDs)
│   ├── common/
│   │   ├── utils/
│   │   │   ├── retry.utility.ts (timeout & retry logic)
│   │   │   └── idempotency.utility.ts (idempotent operations)
│   │   ├── handlers/
│   │   │   └── idempotent-create-event.handler.ts
│   │   └── middleware/
│   │       └── correlation-id.middleware.ts
│   └── modules/
│       ├── auth/            # Authentication microservice
│       ├── events/          # Events microservice
│       └── ...
│
├── apps/
│   ├── auth-service/        # Auth microservice entry point
│   └── events-service/      # Events microservice entry point
│
├── docs/
│   ├── SETUP.md            # Setup and deployment
│   ├── ARCHITECTURE.md      # System design and patterns
│   ├── API.md              # API endpoint documentation
│   ├── RUNBOOK.md          # Operational procedures
│   └── DEMO.md             # Demo script and testing
│
└── libs/shared/
    ├── dto.ts              # Shared data transfer objects
    ├── message-patterns.ts # Microservice RPC patterns
    └── index.ts
```

## Technology Stack

| Component | Technology |
|-----------|-----------|
| Framework | NestJS 11 |
| Language | TypeScript |
| Database | PostgreSQL 16 |
| ORM | TypeORM |
| Container | Docker & Docker Compose |
| Logging | Pino |
| Testing | Jest |
| HTTP Client | Native fetch/axios |

## Performance

- **Startup Time**: ~15-20 seconds (first time), ~5 seconds (cached)
- **Request Latency**: ~50-200ms (Gateway → Microservice → DB)
- **Timeout**: 5 seconds per RPC call
- **Max Connections**: Limited by PostgreSQL and Docker resources

## Next Steps

1. **Review**: [SETUP.md](./docs/SETUP.md) for deployment guide
2. **Explore**: [ARCHITECTURE.md](./docs/ARCHITECTURE.md) for system design
3. **Test**: [DEMO.md](./docs/DEMO.md) for demo script
4. **Deploy**: Follow [RUNBOOK.md](./docs/RUNBOOK.md) for operations

## License

UNLICENSED

## Support

- Check docs/ folder for guides
- Review logs: `docker-compose logs -f`
- Contact: [Your team]

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NODE_ENV` | `development` | Environment mode |

## License

UNLICENSED - Private repository
