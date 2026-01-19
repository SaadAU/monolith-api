# Day 13: Microservices Architecture

## Overview

On Day 13, we split the monolithic application into a microservices architecture using NestJS with TCP as the inter-service communication transport. The system now consists of:

1. **API Gateway** - HTTP entry point that routes requests to microservices
2. **Auth Service** - TCP microservice handling authentication
3. **Events Service** - TCP microservice handling event operations
4. **Shared Library** - Common DTOs and message patterns

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   API Gateway (HTTP)                     │
│                 Port 3000 (API Requests)                 │
└────────┬──────────────────────────────┬──────────────────┘
         │                              │
         │ TCP                          │ TCP
         ▼                              ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│   Auth Service (TCP)    │    │  Events Service (TCP)   │
│  Port 3002              │    │  Port 3001              │
│                         │    │                         │
│ • Login                 │    │ • Create Event          │
│ • Signup                │    │ • List Events           │
│ • Validate Token        │    │ • Update Event          │
│ • Get User              │    │ • Delete Event          │
└────────┬────────────────┘    └──────┬──────────────────┘
         │                            │
         └─────────┬──────────────────┘
                   │
                   ▼
         ┌─────────────────────┐
         │  PostgreSQL DB      │
         │  Port 5432          │
         └─────────────────────┘
```

## Services

### API Gateway (localhost:3000)

**Purpose**: Acts as HTTP-to-TCP proxy that routes HTTP requests to appropriate microservices

**Endpoints**:
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/signup` - Register new user
- `GET /api/v1/auth/me` - Get current user profile
- `POST /api/v1/events` - Create event
- `GET /api/v1/events` - List events
- `GET /api/v1/events/:id` - Get event details
- `POST /api/v1/events/:id` - Update event
- `POST /api/v1/events/:id/delete` - Delete event
- `POST /api/v1/events/:id/approve` - Approve event (admin)
- `POST /api/v1/events/:id/reject` - Reject event (admin)

**Implementation**: [gateway.controller.ts](src/gateway/gateway.controller.ts), [gateway.service.ts](src/gateway/gateway.service.ts)

### Auth Service (localhost:3002)

**Purpose**: Handles all authentication and user management operations

**Message Patterns**:
- `auth.login` - Authenticate user
- `auth.signup` - Register new user
- `auth.validate-token` - Validate JWT token
- `auth.get-user` - Fetch user by ID

**Implementation**: [auth-service/src](../auth-service/src)

**Transport**: TCP on port 3002

### Events Service (localhost:3001)

**Purpose**: Manages all event CRUD operations

**Message Patterns**:
- `events.create` - Create new event
- `events.get` - Get event by ID
- `events.list` - List events with filtering
- `events.update` - Update event
- `events.delete` - Delete event
- `events.approve` - Approve event (admin)
- `events.reject` - Reject event (admin)

**Implementation**: [events-service/src](../events-service/src)

**Transport**: TCP on port 3001

## Technology Stack

### Communication
- **Transport**: TCP (NestJS Microservices)
- **Benefits**:
  - Low latency (faster than HTTP)
  - Built-in serialization
  - Native NestJS support
  - No external dependencies (vs Redis)

### Database
- **PostgreSQL** (shared across services)
- Single database to maintain consistency
- Services share database schema for User, Org, Event entities

## Running Services

### Docker Compose (Recommended)

```bash
docker-compose up
```

This starts:
- PostgreSQL (port 5433)
- API Gateway (port 3000)
- Auth Service (port 3002)
- Events Service (port 3001)

### Local Development

Terminal 1 - API Gateway:
```bash
npm run start:dev
```

Terminal 2 - Auth Service:
```bash
npm run start:auth
```

Terminal 3 - Events Service:
```bash
npm run start:events
```

## API Contracts

### Shared DTOs

All DTOs are defined in [libs/shared/dto.ts](libs/shared/dto.ts):

#### Auth Service DTOs
- `LoginRequestDto`
- `SignupRequestDto`
- `AuthResponseDto`
- `AuthUserDto`
- `ValidateTokenRequestDto`
- `ValidateTokenResponseDto`

#### Events Service DTOs
- `CreateEventRequestDto`
- `EventResponseDto`
- `ListEventsRequestDto`
- `ListEventsResponseDto`
- `UpdateEventRequestDto`
- `DeleteEventRequestDto`
- `ApproveEventRequestDto`
- `RejectEventRequestDto`

## Message Patterns

Message patterns are defined in [libs/shared/message-patterns.ts](libs/shared/message-patterns.ts):

```typescript
// Auth Service Patterns
AUTH_SERVICE_PATTERNS = {
  LOGIN: 'auth.login',
  VALIDATE_TOKEN: 'auth.validate-token',
  REFRESH_TOKEN: 'auth.refresh-token',
  SIGNUP: 'auth.signup',
  GET_USER: 'auth.get-user',
}

// Events Service Patterns
EVENTS_SERVICE_PATTERNS = {
  CREATE_EVENT: 'events.create',
  GET_EVENT: 'events.get',
  LIST_EVENTS: 'events.list',
  UPDATE_EVENT: 'events.update',
  DELETE_EVENT: 'events.delete',
  APPROVE_EVENT: 'events.approve',
  REJECT_EVENT: 'events.reject',
}
```

## Smoke Tests

Basic smoke tests exist to verify:

### Auth Service
✅ User signup
✅ User login with valid credentials
✅ Reject invalid credentials
✅ Get current user profile

### Events Service
✅ Create event
✅ List events
✅ Get event by ID
✅ Update event
✅ Delete event
✅ Unauthorized access rejection

### Integration
✅ Full flow: signup → create event → list events

Run smoke tests:
```bash
npm run test:smoke
```

## Example Workflow

### 1. Signup User

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe"
  }'
```

**Response**:
```json
{
  "message": "Registration successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "orgId": "550e8400-e29b-41d4-a716-446655440001",
    "role": "user"
  }
}
```

### 2. Create Event

**Request**:
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tech Conference 2024",
    "description": "Annual tech conference",
    "startDate": "2024-03-01T09:00:00Z",
    "endDate": "2024-03-03T17:00:00Z",
    "location": "San Francisco",
    "capacity": 500
  }'
```

**Response**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "title": "Tech Conference 2024",
  "description": "Annual tech conference",
  "startDate": "2024-03-01T09:00:00Z",
  "endDate": "2024-03-03T17:00:00Z",
  "location": "San Francisco",
  "capacity": 500,
  "status": "draft",
  "orgId": "550e8400-e29b-41d4-a716-446655440001",
  "createdBy": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "user@example.com"
  },
  "createdAt": "2024-02-15T10:30:00Z",
  "updatedAt": "2024-02-15T10:30:00Z"
}
```

### 3. List Events

**Request**:
```bash
curl -X GET "http://localhost:3000/api/v1/events?skip=0&take=10" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIs..."
```

**Response**:
```json
{
  "items": [...],
  "total": 1,
  "skip": 0,
  "take": 10
}
```

## Configuration

### Environment Variables

**API Gateway**:
- `NODE_ENV` - Environment (development/production)
- `DB_HOST` - PostgreSQL host
- `DB_PORT` - PostgreSQL port
- `AUTH_SERVICE_HOST` - Auth service host
- `AUTH_SERVICE_PORT` - Auth service port
- `EVENTS_SERVICE_HOST` - Events service host
- `EVENTS_SERVICE_PORT` - Events service port

**Auth Service**:
- `NODE_ENV` - Environment
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` - Database connection
- `AUTH_SERVICE_HOST` - Service host to bind to (0.0.0.0 in Docker)
- `AUTH_SERVICE_PORT` - Service port (3002)

**Events Service**:
- `NODE_ENV` - Environment
- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_DATABASE` - Database connection
- `EVENTS_SERVICE_HOST` - Service host to bind to (0.0.0.0 in Docker)
- `EVENTS_SERVICE_PORT` - Service port (3001)

## Benefits of This Architecture

✅ **Scalability**: Services can be scaled independently
✅ **Separation of Concerns**: Each service has single responsibility
✅ **Technology Flexibility**: Services can use different tech stacks (future)
✅ **Independent Deployment**: Services can be deployed separately
✅ **Low Latency**: TCP is faster than HTTP for inter-service communication
✅ **Native NestJS Support**: Microservices are built into NestJS framework

## Future Improvements

- [ ] Add Redis caching layer
- [ ] Implement message queue (RabbitMQ/Kafka) for async operations
- [ ] Add distributed tracing (Jaeger)
- [ ] Implement circuit breaker pattern
- [ ] Add metrics collection (Prometheus)
- [ ] Containerize services separately
- [ ] Add service mesh (Istio) for production
- [ ] Implement API versioning
- [ ] Add request/response logging middleware

## Definition of Done ✅

- ✅ Gateway can perform login and list/create events via services
- ✅ Services run locally via docker-compose
- ✅ Basic smoke tests exist
- ✅ TCP transport configured for inter-service communication
- ✅ Contracts stable across service boundaries
- ✅ Shared libraries for DTOs and patterns

## Testing

Run all tests:
```bash
npm test
```

Run E2E tests:
```bash
npm run test:e2e
```

Run smoke tests:
```bash
npm run test:smoke
```

## Files Created/Modified

### New Files
- [libs/shared/message-patterns.ts](libs/shared/message-patterns.ts) - Message pattern definitions
- [libs/shared/dto.ts](libs/shared/dto.ts) - Shared DTOs
- [libs/shared/index.ts](libs/shared/index.ts) - Shared library exports
- [src/gateway/gateway.module.ts](src/gateway/gateway.module.ts) - Gateway module
- [src/gateway/gateway.service.ts](src/gateway/gateway.service.ts) - Gateway service
- [src/gateway/gateway.controller.ts](src/gateway/gateway.controller.ts) - Gateway controller
- [apps/auth-service/src/main.ts](../auth-service/src/main.ts) - Auth service entry point
- [apps/auth-service/src/services/auth.service.ts](../auth-service/src/services/auth.service.ts) - Auth service logic
- [apps/auth-service/src/controllers/auth.controller.ts](../auth-service/src/controllers/auth.controller.ts) - Auth service controller
- [apps/auth-service/src/auth-service.module.ts](../auth-service/src/auth-service.module.ts) - Auth service module
- [apps/events-service/src/main.ts](../events-service/src/main.ts) - Events service entry point
- [apps/events-service/src/services/events.service.ts](../events-service/src/services/events.service.ts) - Events service logic
- [apps/events-service/src/controllers/events.controller.ts](../events-service/src/controllers/events.controller.ts) - Events service controller
- [apps/events-service/src/events-service.module.ts](../events-service/src/events-service.module.ts) - Events service module
- [Dockerfile.auth](Dockerfile.auth) - Docker image for auth service
- [Dockerfile.events](Dockerfile.events) - Docker image for events service
- [test/microservices.smoke.spec.ts](test/microservices.smoke.spec.ts) - Smoke tests
- [test/jest-smoke.json](test/jest-smoke.json) - Jest configuration for smoke tests
- [docs/day-13.md](docs/day-13.md) - This documentation

### Modified Files
- [package.json](package.json) - Added @nestjs/microservices, new scripts
- [docker-compose.yml](docker-compose.yml) - Added services for microservices
- [tsconfig.json](tsconfig.json) - Added path aliases for shared library
- [src/app.module.ts](src/app.module.ts) - Added GatewayModule
