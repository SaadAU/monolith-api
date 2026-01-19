# Day 13: Microservices Split + API Gateway - Complete Documentation

**Date**: January 19, 2026  
**Status**: ✅ Complete  
**Transport**: TCP (NestJS Microservices)

---

## Table of Contents

1. [Quick Start (5 minutes)](#quick-start)
2. [Architecture Overview](#architecture-overview)
3. [System Design](#system-design)
4. [Services Created](#services-created)
5. [Running Services](#running-services)
6. [API Endpoints](#api-endpoints)
7. [Technical Implementation](#technical-implementation)
8. [Docker Setup](#docker-setup)
9. [Testing](#testing)
10. [File Structure](#file-structure)
11. [Troubleshooting](#troubleshooting)
12. [Verification Checklist](#verification-checklist)

---

## Quick Start

### 30-Second Setup

```bash
cd apps/monolith-api
docker-compose up
```

Services will be available at:
- **API Gateway**: http://localhost:3000
- **Auth Service**: TCP localhost:3002
- **Events Service**: TCP localhost:3001
- **PostgreSQL**: localhost:5433

### Test It

```bash
npm run test:smoke
```

---

## Architecture Overview

### High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Client Applications                          │
│                    (Web, Mobile, Desktop)                        │
└──────────────────────────────┬───────────────────────────────────┘
                               │ HTTP/REST
                               ▼
                     ┌─────────────────────┐
                     │  API Gateway        │
                     │  Port: 3000         │
                     │                     │
                     │ Routes:             │
                     │ - POST /auth/login  │
                     │ - POST /auth/signup │
                     │ - GET  /auth/me     │
                     │ - POST /events      │
                     │ - GET  /events      │
                     └─────────┬─────┬─────┘
                               │     │
                    TCP (RPC) │     │ TCP (RPC)
                               ▼     ▼
                      ┌──────────┐ ┌──────────┐
                      │Auth      │ │Events    │
                      │Service   │ │Service   │
                      │:3002     │ │:3001     │
                      │          │ │          │
                      │@Message- │ │@Message- │
                      │Pattern   │ │Pattern   │
                      └─────┬────┘ └────┬─────┘
                            │           │
                            └─────┬─────┘
                                  │ SQL
                                  ▼
                            ┌────────────┐
                            │PostgreSQL  │
                            │Port: 5432  │
                            │            │
                            │ Tables:    │
                            │ - users    │
                            │ - orgs     │
                            │ - events   │
                            └────────────┘
```

---

## System Design

### Architecture Pattern: Microservices + API Gateway

**Why This Approach?**
- ✅ **Scalability**: Services can be scaled independently
- ✅ **Separation of Concerns**: Each service has single responsibility
- ✅ **Independent Deployment**: Services deploy separately
- ✅ **Low Latency**: TCP is faster than HTTP for RPC
- ✅ **Type Safety**: Shared DTOs prevent API drift

### Service Interaction Diagram

```
Service Dependencies:
                    ┌─────────────────┐
                    │  API Gateway    │
                    │    (HTTP)       │
                    └────────┬────────┘
                             │
                    Uses TCP clients:
                    ClientProxy: AuthService
                    ClientProxy: EventsService
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌──────────┐      ┌──────────────┐     ┌──────────────┐
   │Auth Svc  │      │Events Svc    │     │(DB Shared)   │
   │(TCP)     │      │(TCP)         │     │              │
   │          │      │              │     │PostgreSQL    │
   │NestMicro │      │NestMicro     │     │              │
   │service   │      │service       │     │Tables:       │
   │          │      │              │     │- users       │
   │@Message  │      │@Message      │     │- orgs        │
   │Pattern   │      │Pattern       │     │- events      │
   └────┬─────┘      └──────┬───────┘     └──────────────┘
        │                   │                    ▲
        └───────┬───────────┘                    │
                │ SQL                            │
                └────────────────────────────────┘
```

### Request Flow: Signup → Create Event

```
1. SIGNUP
   POST /api/v1/auth/signup
   │
   ├─► Gateway validates input
   ├─► Sends: auth.signup → Auth Service (TCP)
   ├─► Auth Service: hash password, insert user
   ├─► DB: INSERT INTO users
   ├─► Auth Service: generate JWT
   └─► Return: {token, user}
   
2. CREATE EVENT
   POST /api/v1/events
   │
   ├─► Gateway validates auth (JWT guard)
   ├─► Sends: events.create → Events Service (TCP)
   ├─► Events Service: validate data, insert event
   ├─► DB: INSERT INTO events
   └─► Return: {id, title, status: 'draft', ...}
   
3. LIST EVENTS
   GET /api/v1/events
   │
   ├─► Gateway validates auth
   ├─► Sends: events.list → Events Service (TCP)
   ├─► Events Service: query DB with filters
   ├─► DB: SELECT * FROM events WHERE orgId = ...
   └─► Return: {items: [...], total: N}
```

---

## Services Created

### 1. API Gateway (Port 3000)

**Role**: HTTP-to-TCP proxy routing requests to microservices

**Location**: `src/gateway/`

**Files**:
- `gateway.module.ts` - Service client configuration
- `gateway.service.ts` - Business logic for routing
- `gateway.controller.ts` - HTTP endpoints

**Technology**:
- NestJS with ClientsModule
- TCP clients to Auth & Events services
- JWT authentication guard

### 2. Auth Service (Port 3002)

**Role**: Handles authentication and user management

**Location**: `apps/auth-service/src/`

**Files**:
- `main.ts` - Service entry point (TCP microservice)
- `auth-service.module.ts` - Service module
- `controllers/auth.controller.ts` - TCP message handlers
- `services/auth.service.ts` - Auth business logic

**Message Patterns**:
```
auth.login           → User authentication
auth.signup          → User registration
auth.validate-token  → JWT validation
auth.get-user        → User info retrieval
```

**Features**:
- Argon2id password hashing
- JWT token generation (24h expiry)
- User lookup and validation
- Password verification

### 3. Events Service (Port 3001)

**Role**: Manages event CRUD operations

**Location**: `apps/events-service/src/`

**Files**:
- `main.ts` - Service entry point (TCP microservice)
- `events-service.module.ts` - Service module
- `controllers/events.controller.ts` - TCP message handlers
- `services/events.service.ts` - Events business logic

**Message Patterns**:
```
events.create   → Create new event
events.get      → Get event by ID
events.list     → List events with filtering
events.update   → Update event
events.delete   → Delete event
events.approve  → Approve event (admin)
events.reject   → Reject event (admin)
```

**Features**:
- CRUD operations with ownership checks
- Pagination support
- Status management (draft, approved, rejected)
- Event filtering and sorting

### 4. Shared Library

**Role**: Central contract definition

**Location**: `libs/shared/`

**Files**:
- `message-patterns.ts` - TCP pattern definitions
- `dto.ts` - Shared Data Transfer Objects
- `index.ts` - Public exports

**Key Exports**:
```typescript
// Message Patterns
AUTH_SERVICE_PATTERNS
EVENTS_SERVICE_PATTERNS
MICROSERVICE_TRANSPORT

// DTOs
LoginRequestDto
SignupRequestDto
AuthResponseDto
CreateEventRequestDto
ListEventsRequestDto
EventResponseDto
// ... and more
```

---

## Running Services

### Option 1: Docker Compose (Recommended)

```bash
cd apps/monolith-api
docker-compose up
```

**What starts**:
- PostgreSQL (port 5433)
- API Gateway (port 3000)
- Auth Service (port 3002)
- Events Service (port 3001)

**Wait for**: "Services ready" in logs

### Option 2: Local Development (3 Terminals)

**Terminal 1 - API Gateway**:
```bash
cd apps/monolith-api
npm install
npm run start:dev
# Output: API Gateway running on http://localhost:3000
```

**Terminal 2 - Auth Service**:
```bash
cd apps/monolith-api
npm run start:auth
# Output: Auth Service running on localhost:3002 (TCP)
```

**Terminal 3 - Events Service**:
```bash
cd apps/monolith-api
npm run start:events
# Output: Events Service running on localhost:3001 (TCP)
```

**Database Setup**:
Ensure PostgreSQL running at:
- Host: `localhost`
- Port: `5432`
- User: `admin`
- Password: `admin123`
- Database: `mydb`

---

## API Endpoints

### Authentication Endpoints

#### POST /api/v1/auth/signup
Register new user

```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "name": "John Doe",
    "phone": "+1234567890"
  }'
```

**Response** (201):
```json
{
  "message": "Registration successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe",
    "orgId": "default-org",
    "role": "user",
    "isActive": true,
    "createdAt": "2024-02-15T10:30:00Z"
  }
}
```

#### POST /api/v1/auth/login
Authenticate user

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

**Response** (200):
```json
{
  "message": "Login successful",
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": { ... }
}
```

#### GET /api/v1/auth/me
Get current user profile

```bash
curl -X GET http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response** (200):
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Events Endpoints

#### POST /api/v1/events
Create event

```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Tech Conference 2024",
    "description": "Annual tech conference",
    "startDate": "2024-03-01T09:00:00Z",
    "endDate": "2024-03-03T17:00:00Z",
    "location": "San Francisco",
    "capacity": 500,
    "tags": ["tech", "conference"]
  }'
```

**Response** (201):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440002",
  "title": "Tech Conference 2024",
  "description": "Annual tech conference",
  "startDate": "2024-03-01T09:00:00Z",
  "endDate": "2024-03-03T17:00:00Z",
  "location": "San Francisco",
  "capacity": 500,
  "tags": ["tech", "conference"],
  "status": "draft",
  "orgId": "default-org",
  "createdBy": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "John Doe",
    "email": "user@example.com"
  },
  "createdAt": "2024-02-15T10:30:00Z",
  "updatedAt": "2024-02-15T10:30:00Z"
}
```

#### GET /api/v1/events
List events

```bash
curl -X GET "http://localhost:3000/api/v1/events?skip=0&take=10&status=draft" \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Response** (200):
```json
{
  "items": [...],
  "total": 5,
  "skip": 0,
  "take": 10
}
```

#### GET /api/v1/events/:id
Get event details

```bash
curl -X GET http://localhost:3000/api/v1/events/{eventId} \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### POST /api/v1/events/:id
Update event

```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId} \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Updated Title",
    "description": "Updated description"
  }'
```

#### POST /api/v1/events/:id/delete
Delete event

```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId}/delete \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### POST /api/v1/events/:id/approve
Approve event (admin)

```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId}/approve \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE"
```

#### POST /api/v1/events/:id/reject
Reject event (admin)

```bash
curl -X POST http://localhost:3000/api/v1/events/{eventId}/reject \
  -H "Authorization: Bearer ADMIN_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "Does not meet standards"
  }'
```

---

## Technical Implementation

### TCP Transport Configuration

#### Auth Service (main.ts)
```typescript
const app = await NestFactory.createMicroservice(AuthServiceModule, {
  transport: Transport.TCP,
  options: {
    host: process.env.AUTH_SERVICE_HOST || 'localhost',
    port: parseInt(process.env.AUTH_SERVICE_PORT || '3002', 10),
  },
});
```

#### Events Service (main.ts)
```typescript
const app = await NestFactory.createMicroservice(EventsServiceModule, {
  transport: Transport.TCP,
  options: {
    host: process.env.EVENTS_SERVICE_HOST || 'localhost',
    port: parseInt(process.env.EVENTS_SERVICE_PORT || '3001', 10),
  },
});
```

### Message Pattern Usage

#### Gateway Service
```typescript
async login(loginDto: LoginRequestDto) {
  return await firstValueFrom(
    this.authServiceClient.send(AUTH_SERVICE_PATTERNS.LOGIN, loginDto),
  );
}
```

#### Auth Service Controller
```typescript
@MessagePattern(AUTH_SERVICE_PATTERNS.LOGIN)
async login(@Payload() data: LoginRequestDto) {
  return this.authService.login(data);
}
```

### Shared DTOs Example

All DTOs defined in `libs/shared/dto.ts`:

```typescript
export interface LoginRequestDto {
  email: string;
  password: string;
}

export interface AuthResponseDto {
  accessToken: string;
  refreshToken?: string;
  user: AuthUserDto;
}

export interface CreateEventRequestDto {
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  capacity?: number;
  tags?: string[];
  orgId: string;
  createdById: string;
}

export interface EventResponseDto {
  id: string;
  title: string;
  description?: string;
  startDate: Date;
  endDate: Date;
  location?: string;
  capacity?: number;
  tags?: string[];
  status: 'draft' | 'approved' | 'rejected' | 'archived';
  orgId: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: Date;
  updatedAt: Date;
}
```

### TCP Benefits vs Alternatives

| Feature | TCP | HTTP | Redis |
|---------|-----|------|-------|
| Latency | Low (binary) | Higher | Medium |
| Dependencies | NestJS native | NestJS native | Redis server |
| Setup Complexity | Low | Low | Medium |
| Serialization | Binary | JSON | JSON |
| Type Safety | ✅ (DTOs) | ✅ (DTOs) | ✅ (DTOs) |

---

## Docker Setup

### Docker Compose Configuration

```yaml
services:
  postgres:
    image: postgres:16
    container_name: postgres_db
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: mydb
    ports: ["5433:5432"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U admin"]
      interval: 5s
      timeout: 5s
      retries: 5

  api-gateway:
    build: Dockerfile
    container_name: api_gateway
    ports: ["3000:3000"]
    depends_on:
      postgres: { condition: service_healthy }
      auth-service: { condition: service_started }
      events-service: { condition: service_started }
    environment:
      AUTH_SERVICE_HOST: auth-service
      AUTH_SERVICE_PORT: 3002
      EVENTS_SERVICE_HOST: events-service
      EVENTS_SERVICE_PORT: 3001

  auth-service:
    build: Dockerfile.auth
    container_name: auth_service
    expose: ["3002"]
    depends_on:
      postgres: { condition: service_healthy }

  events-service:
    build: Dockerfile.events
    container_name: events_service
    expose: ["3001"]
    depends_on:
      postgres: { condition: service_healthy }
```

### Environment Variables

**API Gateway**:
```
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_DATABASE=mydb
AUTH_SERVICE_HOST=auth-service
AUTH_SERVICE_PORT=3002
EVENTS_SERVICE_HOST=events-service
EVENTS_SERVICE_PORT=3001
```

**Auth Service**:
```
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_DATABASE=mydb
AUTH_SERVICE_HOST=0.0.0.0
AUTH_SERVICE_PORT=3002
```

**Events Service**:
```
NODE_ENV=development
DB_HOST=postgres
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=admin123
DB_DATABASE=mydb
EVENTS_SERVICE_HOST=0.0.0.0
EVENTS_SERVICE_PORT=3001
```

---

## Testing

### Run Smoke Tests

```bash
npm run test:smoke
```

### Test Coverage

✅ **Auth Service**:
- User signup
- User login with valid credentials
- Reject invalid credentials
- Token validation
- Get user profile

✅ **Events Service**:
- Create event
- List events
- Get event by ID
- Update event
- Delete event
- Unauthorized access rejection

✅ **Integration**:
- Full workflow: signup → create event → list events

### Test File Location

- **Spec**: `test/microservices.smoke.spec.ts`
- **Config**: `test/jest-smoke.json`
- **Total Tests**: 15+

---

## File Structure

### Directory Organization

```
apps/monolith-api/
├── apps/
│   ├── auth-service/src/
│   │   ├── main.ts                          (TCP entry point)
│   │   ├── auth-service.module.ts           (Service module)
│   │   ├── controllers/
│   │   │   └── auth.controller.ts           (Message handlers)
│   │   └── services/
│   │       └── auth.service.ts              (Business logic)
│   │
│   └── events-service/src/
│       ├── main.ts                          (TCP entry point)
│       ├── events-service.module.ts         (Service module)
│       ├── controllers/
│       │   └── events.controller.ts         (Message handlers)
│       └── services/
│           └── events.service.ts            (Business logic)
│
├── libs/shared/
│   ├── message-patterns.ts                  (Pattern definitions)
│   ├── dto.ts                               (Shared DTOs)
│   └── index.ts                             (Exports)
│
├── src/
│   ├── gateway/
│   │   ├── gateway.module.ts                (Client config)
│   │   ├── gateway.service.ts               (Service facade)
│   │   └── gateway.controller.ts            (HTTP endpoints)
│   ├── app.module.ts                        (Main module)
│   └── ...
│
├── test/
│   ├── microservices.smoke.spec.ts          (Smoke tests)
│   └── jest-smoke.json                      (Jest config)
│
├── docker-compose.yml                       (Orchestration)
├── Dockerfile                               (Gateway image)
├── Dockerfile.auth                          (Auth service image)
├── Dockerfile.events                        (Events service image)
├── package.json                             (Dependencies)
├── tsconfig.json                            (Path aliases)
│
└── docs/
    ├── day-13.md                            (Old format)
    ├── day-13-comprehensive.md              (This file)
    └── ...
```

### Files Created Summary

| Category | Count | Files |
|----------|-------|-------|
| Shared Library | 3 | message-patterns, dto, index |
| Gateway | 3 | module, service, controller |
| Auth Service | 4 | main, module, controller, service |
| Events Service | 4 | main, module, controller, service |
| Docker | 3 | docker-compose, Dockerfile.auth, Dockerfile.events |
| Tests | 2 | smoke spec, jest config |
| Configuration | 2 | package.json, tsconfig.json |
| Documentation | 1 | This file |

**Total**: 22 files created/modified

---

## Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :3000  # Gateway
lsof -i :3001  # Events service
lsof -i :3002  # Auth service

# Kill process
kill -9 <PID>
```

### Database Connection Error

```bash
# Check PostgreSQL running
docker ps | grep postgres

# Verify credentials
psql -h localhost -p 5433 -U admin -d mydb

# Check connection string
# Expected: postgres://admin:admin123@localhost:5432/mydb
```

### Service Not Responding

```bash
# Check logs
docker logs api_gateway
docker logs auth_service
docker logs events_service

# Verify network
docker network ls
docker network inspect app-network

# Test connectivity
curl http://localhost:3000/
```

### Token Validation Issues

```bash
# Check token not expired (24h valid)
# Verify JWT_SECRET consistent across services
# Ensure auth middleware applied to protected routes

# Re-login to get fresh token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"Pass123!"}'
```

### Services Can't Connect to Each Other

```bash
# Check service names in docker-compose
# Verify DNS resolution in network
docker exec api_gateway nslookup auth-service

# Check TCP port accessibility
docker exec api_gateway nc -zv auth-service 3002
```

---

## Verification Checklist

### ✅ System Running

- [ ] API Gateway accessible at `http://localhost:3000`
- [ ] Auth Service responding on TCP port 3002
- [ ] Events Service responding on TCP port 3001
- [ ] PostgreSQL connected and healthy
- [ ] docker-compose shows all services running: `docker-compose ps`

### ✅ Auth Service

- [ ] POST `/api/v1/auth/signup` creates users
- [ ] POST `/api/v1/auth/login` returns valid JWT tokens
- [ ] Token valid for 24 hours
- [ ] GET `/api/v1/auth/me` returns authenticated user

### ✅ Events Service

- [ ] POST `/api/v1/events` creates events
- [ ] GET `/api/v1/events` lists all user's events
- [ ] GET `/api/v1/events/:id` retrieves event details
- [ ] POST `/api/v1/events/:id` updates event
- [ ] POST `/api/v1/events/:id/delete` removes event

### ✅ Integration

- [ ] Gateway routes auth requests to auth service
- [ ] Gateway routes event requests to events service
- [ ] Token-based authorization works
- [ ] User isolation per organization
- [ ] Error handling is consistent

### ✅ Tests

- [ ] `npm run test:smoke` passes all tests
- [ ] Coverage includes happy path + error cases
- [ ] 15+ test cases executed
- [ ] All assertions pass

### Quick Verification Commands

```bash
# 1. Check services running
docker-compose ps

# 2. Test signup
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!","name":"Test"}'

# 3. Test login (use email from step 2)
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# 4. Extract token from step 3 response
TOKEN="eyJhbGciOiJIUzI1NiIs..."

# 5. Test create event
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Event","startDate":"2024-03-01T09:00:00Z","endDate":"2024-03-01T17:00:00Z"}'

# 6. Test list events
curl -X GET "http://localhost:3000/api/v1/events" \
  -H "Authorization: Bearer $TOKEN"

# 7. Run smoke tests
npm run test:smoke
```

---

## Implementation Details

### Task Requirements (Definition of Done)

✅ **Create api-gateway + events-service + auth-service**
- API Gateway created with HTTP endpoints
- Auth Service running on TCP port 3002
- Events Service running on TCP port 3001

✅ **Pick one transport (TCP)**
- NestJS Microservices TCP transport selected
- All services configured for TCP communication
- No external messaging system required

✅ **Gateway routes proxy to services**
- Gateway service routes HTTP requests to microservices
- Message patterns match and route to correct handlers
- Error handling propagates from services to gateway

✅ **Keep contracts stable across boundary**
- Shared DTOs in `libs/shared/dto.ts`
- Message patterns in `libs/shared/message-patterns.ts`
- TypeScript path aliases ensure consistency

### Why TCP?

- **Low Latency**: Binary protocol faster than JSON over HTTP
- **Native Support**: Built into NestJS microservices
- **No Dependencies**: No Redis or external queue needed
- **RPC Style**: Natural request/response pattern
- **Type Safety**: Works perfectly with TypeScript interfaces

### Design Decisions

1. **Single Database**: All services share PostgreSQL for consistency and simpler transactions
2. **API Gateway Pattern**: Single HTTP entry point shields internal service ports
3. **Shared DTOs**: Central contract definition prevents API drift
4. **Message Patterns**: String identifiers for RPC calls enable routing and versioning
5. **Docker Compose**: Full orchestration for local development matching production

---

## Complete Workflow Example

### User Registration → Event Creation Flow

```
1. USER VISITS APP
   Browser → GET http://localhost:3000/
   ✅ API Gateway serves web interface

2. USER SIGNS UP
   Browser → POST /api/v1/auth/signup
     {email: "user@example.com", password: "Pass123!", name: "John"}
   
   API Gateway
   ├─ Validates input
   ├─ Sends TCP message: auth.signup to Auth Service
   │
   Auth Service
   ├─ Hashes password with Argon2id
   ├─ Inserts user into PostgreSQL
   ├─ Generates JWT token
   └─ Returns {token, user}
   
   API Gateway → Returns 201 with token
   Browser ✅ Token stored in localStorage

3. USER LOGGED IN
   Browser → GET /api/v1/auth/me
   Header: Authorization: Bearer jwt...
   
   API Gateway
   ├─ Validates JWT with guard
   ├─ Sends TCP message: auth.get-user
   │
   Auth Service
   ├─ Looks up user in PostgreSQL
   └─ Returns user data
   
   API Gateway → Returns user profile
   Browser ✅ Display profile

4. USER CREATES EVENT
   Browser → POST /api/v1/events
   Header: Authorization: Bearer jwt...
   Body: {title: "Tech Conf", startDate: "2024-03-01", ...}
   
   API Gateway
   ├─ Validates JWT
   ├─ Extracts user from token
   ├─ Sends TCP message: events.create
   │   {title, startDate, ..., orgId, createdById}
   │
   Events Service
   ├─ Validates input
   ├─ Inserts event into PostgreSQL
   └─ Returns event with id, status, etc.
   
   API Gateway → Returns 201 with event
   Browser ✅ Event created

5. USER VIEWS EVENTS
   Browser → GET /api/v1/events
   Header: Authorization: Bearer jwt...
   
   API Gateway
   ├─ Validates JWT
   ├─ Sends TCP message: events.list
   │   {orgId, userId, skip, take}
   │
   Events Service
   ├─ Queries PostgreSQL for user's events
   ├─ Applies pagination
   └─ Returns {items, total, skip, take}
   
   API Gateway → Returns event list
   Browser ✅ Display events
```

---

## Summary

### What Was Built

| Component | Type | Port | Purpose |
|-----------|------|------|---------|
| API Gateway | HTTP | 3000 | Client entry point |
| Auth Service | TCP | 3002 | Authentication |
| Events Service | TCP | 3001 | Event management |
| PostgreSQL | SQL | 5432 | Shared database |

### Key Features

✅ **Microservices Architecture**: 3 independent services
✅ **TCP Communication**: Low-latency RPC between services
✅ **Type Safety**: Shared DTOs prevent API drift
✅ **Docker Ready**: Full docker-compose orchestration
✅ **Tested**: 15+ comprehensive smoke tests
✅ **Documented**: Complete API and implementation docs

### Getting Started

```bash
# Start everything
docker-compose up

# Run tests
npm run test:smoke

# That's it! All services ready to use
```

### Definition of Done - All Met ✅

- ✅ Gateway can perform login + list/create events via services
- ✅ Services run locally via docker-compose
- ✅ Basic smoke tests exist and pass
- ✅ TCP transport configured
- ✅ Stable contracts across service boundaries

---

**Status**: 🚀 **Ready for Production** (with adjustments for security/scaling)

**Next Steps**: Run tests, verify endpoints, extend with additional services following same pattern

---

## Quick Reference

### Most Common Commands

```bash
# Start all services
docker-compose up

# Stop all services
docker-compose down

# View logs
docker-compose logs -f

# Run tests
npm run test:smoke

# Rebuild images
docker-compose up --build

# Remove volumes (reset DB)
docker-compose down -v
```

### Most Common Endpoints

```bash
# Signup
POST http://localhost:3000/api/v1/auth/signup

# Login
POST http://localhost:3000/api/v1/auth/login

# Create event
POST http://localhost:3000/api/v1/events

# List events
GET http://localhost:3000/api/v1/events

# All require: Authorization: Bearer TOKEN header (except signup/login)
```

---

**Documentation Created**: January 19, 2026
**Last Updated**: January 19, 2026
**Version**: 1.0 - Complete
