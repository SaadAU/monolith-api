# API Documentation

## Base URL

```
http://localhost:3000/api/v1
```

## Authentication

All endpoints (except `/auth/login` and `/auth/signup`) require Bearer token authentication.

### Headers
```
Authorization: Bearer <jwt_token>
x-request-id: <correlation-id>  (optional, auto-generated if not provided)
```

### Example
```bash
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
     http://localhost:3000/api/v1/events
```

## Response Format

All responses follow a consistent envelope format:

### Success Response
```json
{
  "message": "Operation successful",
  "data": { /* response payload */ },
  "timestamp": "2024-01-20T10:30:00Z",
  "correlationId": "req-123"
}
```

### Error Response
```json
{
  "statusCode": 400,
  "message": "Bad Request",
  "error": "Validation failed",
  "timestamp": "2024-01-20T10:30:00Z",
  "correlationId": "req-123"
}
```

## Error Codes

| Code | Meaning | Resolution |
|------|---------|-----------|
| 400 | Bad Request | Check request body and format |
| 401 | Unauthorized | Provide valid JWT token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Contact support |
| 503 | Service Unavailable | Retry later |

---

## Authentication Endpoints

### 1. Login

Register user credentials and obtain JWT token.

```
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "message": "Login successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "orgId": "110e8400-e29b-41d4-a716-446655440000",
      "role": "USER",
      "isActive": true,
      "createdAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-20T10:00:00Z"
    }
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Errors**:
- `401 Unauthorized`: Invalid email or password
- `400 Bad Request`: Missing required fields

---

### 2. Signup

Create a new user account.

```
POST /auth/signup
Content-Type: application/json

{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "name": "Jane Doe",
  "phone": "+1-555-0123" (optional)
}
```

**Response** (201 Created):
```json
{
  "message": "Registration successful",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "newuser@example.com",
      "name": "Jane Doe",
      "orgId": "110e8400-e29b-41d4-a716-446655440000",
      "role": "USER",
      "isActive": true,
      "phone": "+1-555-0123",
      "createdAt": "2024-01-20T10:30:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    }
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Errors**:
- `400 Bad Request`: Invalid email format or password too weak
- `409 Conflict`: Email already registered

---

### 3. Get Current User Profile

Fetch authenticated user's profile.

```
GET /auth/me
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Success",
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "John Doe",
      "orgId": "110e8400-e29b-41d4-a716-446655440000",
      "role": "USER",
      "isActive": true,
      "lastLoginAt": "2024-01-20T10:30:00Z",
      "createdAt": "2024-01-20T10:00:00Z",
      "updatedAt": "2024-01-20T10:30:00Z"
    }
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Errors**:
- `401 Unauthorized`: Invalid or missing token

---

## Event Endpoints

### 1. Create Event

Create a new event in the organization.

```
POST /events
Authorization: Bearer <token>
Content-Type: application/json
Idempotency-Key: <unique-key> (optional)

{
  "title": "Tech Conference 2024",
  "description": "Annual technology conference",
  "startDate": "2024-03-15T09:00:00Z",
  "endDate": "2024-03-15T17:00:00Z",
  "location": "San Francisco, CA",
  "capacity": 500
}
```

**Response** (201 Created):
```json
{
  "message": "Success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Tech Conference 2024",
    "description": "Annual technology conference",
    "startDate": "2024-03-15T09:00:00Z",
    "endDate": "2024-03-15T17:00:00Z",
    "location": "San Francisco, CA",
    "capacity": 500,
    "status": "DRAFT",
    "orgId": "110e8400-e29b-41d4-a716-446655440000",
    "createdById": "550e8400-e29b-41d4-a716-446655440000",
    "createdAt": "2024-01-20T10:30:00Z",
    "updatedAt": "2024-01-20T10:30:00Z"
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Features**:
- Automatic organization scoping (`orgId` from token)
- Idempotency support (same key returns cached result)
- Timeout: 5 seconds with 3 automatic retries

**Errors**:
- `400 Bad Request`: Invalid data or dates
- `401 Unauthorized`: Invalid token
- `409 Conflict`: Idempotency key collision with different data

---

### 2. Get Event

Retrieve a specific event by ID.

```
GET /events/{id}
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Tech Conference 2024",
    "status": "DRAFT",
    "createdAt": "2024-01-20T10:30:00Z"
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

**Errors**:
- `404 Not Found`: Event doesn't exist
- `401 Unauthorized`: Invalid token

---

### 3. List Events

Retrieve a paginated list of events in the organization.

```
GET /events?skip=0&take=10&status=DRAFT
Authorization: Bearer <token>
```

**Query Parameters**:
- `skip` (optional, default 0): Number of events to skip
- `take` (optional, default 10): Number of events to return (max 50)
- `status` (optional): Filter by status (DRAFT, SUBMITTED, APPROVED, REJECTED)

**Response** (200 OK):
```json
{
  "message": "Success",
  "data": {
    "items": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440000",
        "title": "Event 1",
        "status": "DRAFT"
      },
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "title": "Event 2",
        "status": "APPROVED"
      }
    ],
    "pagination": {
      "total": 42,
      "skip": 0,
      "take": 10,
      "hasMore": true
    }
  },
  "timestamp": "2024-01-20T10:30:00Z"
}
```

---

### 4. Update Event

Modify an existing event.

```
POST /events/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Tech Conference 2024 - Updated",
  "capacity": 600
}
```

**Response** (200 OK):
```json
{
  "message": "Success",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "title": "Tech Conference 2024 - Updated",
    "capacity": 600,
    "status": "DRAFT",
    "updatedAt": "2024-01-20T10:31:00Z"
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

**Ownership**:
- Only event creator or admins can update

**Errors**:
- `403 Forbidden`: Not the event owner
- `404 Not Found`: Event doesn't exist

---

### 5. Delete Event

Soft-delete an event (marked as deleted but not removed from DB).

```
POST /events/{id}/delete
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Event deleted successfully",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "deletedAt": "2024-01-20T10:31:00Z"
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

**Ownership**:
- Only event creator or admins can delete

---

### 6. Submit Event for Approval

Submit a draft event for moderation.

```
POST /events/{id}/submit
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Event submitted for approval",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "SUBMITTED",
    "updatedAt": "2024-01-20T10:31:00Z"
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

**Status Transition**: DRAFT → SUBMITTED

---

### 7. Approve Event

Approve a submitted event (admin/moderator only).

```
POST /events/{id}/approve
Authorization: Bearer <token>
```

**Response** (200 OK):
```json
{
  "message": "Event approved",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "APPROVED",
    "approvedById": "550e8400-e29b-41d4-a716-446655440000",
    "approvedAt": "2024-01-20T10:31:00Z"
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

**Permissions**:
- ADMIN or MODERATOR role required

**Status Transition**: SUBMITTED → APPROVED

---

### 8. Reject Event

Reject a submitted event with reason.

```
POST /events/{id}/reject
Authorization: Bearer <token>
Content-Type: application/json

{
  "reason": "Event location not yet confirmed"
}
```

**Response** (200 OK):
```json
{
  "message": "Event rejected",
  "data": {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "status": "REJECTED",
    "rejectionReason": "Event location not yet confirmed",
    "rejectedById": "550e8400-e29b-41d4-a716-446655440000",
    "rejectedAt": "2024-01-20T10:31:00Z"
  },
  "timestamp": "2024-01-20T10:31:00Z"
}
```

**Permissions**:
- ADMIN or MODERATOR role required

**Status Transition**: SUBMITTED → REJECTED

---

## Status Codes Reference

### HTTP Status Codes

| Code | Usage |
|------|-------|
| 200 | Successful GET, POST, PUT |
| 201 | Successful resource creation |
| 400 | Validation error, bad request format |
| 401 | Missing or invalid authentication |
| 403 | Authenticated but insufficient permissions |
| 404 | Resource not found |
| 409 | Resource already exists (conflict) |
| 429 | Rate limit exceeded |
| 500 | Internal server error |
| 503 | Service temporarily unavailable |

### Event Status Values

| Status | Description | Transitions |
|--------|-------------|-------------|
| DRAFT | Initial state, not yet submitted | → SUBMITTED |
| SUBMITTED | Awaiting approval | → APPROVED, REJECTED, DRAFT |
| APPROVED | Approved by moderator | → CANCELLED |
| REJECTED | Rejected by moderator | → DRAFT |
| CANCELLED | Event cancelled | None |

---

## Resilience Features

### Automatic Retries
- All microservice calls retry up to 3 times
- Exponential backoff: 100ms, 200ms, 400ms
- Timeout per call: 5 seconds
- Errors are retried transparently; client sees only final result

### Idempotency
- Provide `Idempotency-Key` header for create operations
- Same key + same data = guaranteed same response
- Duplicate requests return cached result (24-hour TTL)

**Example**:
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: create-event-2024-jan-20" \
  -H "Content-Type: application/json" \
  -d '{...}'

# Call again with same key gets cached response
```

### Request Tracing
- Automatic `x-request-id` header generation
- Passed through all service calls
- Included in response headers
- Use for debugging across distributed services

```bash
curl -H "x-request-id: my-trace-123" http://localhost:3000/api/v1/events

# Response includes: x-request-id: my-trace-123
```

---

## Rate Limiting (Future)

Currently no rate limiting. In production:
- 100 requests/minute per IP
- 1000 requests/minute per authenticated user
- Returns 429 Too Many Requests

---

## Changelog

### Day 14 Updates
- Added timeout and retry strategy on all gateway calls
- Added idempotency example for create operations
- Correlation ID propagation across services
- Comprehensive API documentation

---

## Support

For issues or questions:
1. Check [SETUP.md](./SETUP.md) for setup help
2. Review [RUNBOOK.md](./RUNBOOK.md) for operational issues
3. Check logs: `docker-compose logs -f api-gateway`
4. Contact development team
