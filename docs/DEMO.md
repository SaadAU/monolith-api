# Demo Checklist & Testing Guide

## Pre-Demo Checklist

### System Readiness
- [ ] All services running with `docker-compose up`
- [ ] API Gateway responds at http://localhost:3000/api/v1
- [ ] PostgreSQL accessible and healthy
- [ ] No error logs in console
- [ ] Test correlation ID propagation before demo

### Setup
```bash
# Full reset
docker-compose down -v
docker-compose up --build

# Wait for startup (watch for "listening on port" messages)
# Approx 15-20 seconds
```

---

## Demo Flow (15-20 minutes)

### 1. System Overview (2 min)

**Show Architecture**:
```bash
# Terminal 1: Show services running
docker-compose ps

# Show the stack
echo "API Gateway: http://localhost:3000"
echo "Auth Service: localhost:3002 (TCP)"
echo "Events Service: localhost:3001 (TCP)"
echo "Database: localhost:5433"
```

**Explain**:
- Single entry point (Gateway)
- Microservices for Auth and Events
- PostgreSQL backend
- All running locally with one command

---

### 2. Resilience Demo (4 min)

#### 2.1 Retry Strategy

**Explain**: "Watch what happens when a service temporarily fails"

```bash
# Terminal 2: Monitor logs
docker-compose logs -f api-gateway | grep -i "retry\|attempt"

# Terminal 1: Make a login request
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Expected: Success (even if there are transient issues)
# Look for: Retry logs showing attempts
```

**Key Points**:
- Automatic retries with exponential backoff
- 100ms, 200ms, 400ms delays between attempts
- 5-second timeout per attempt
- Client sees only final result

#### 2.2 Timeout Handling

**Explain**: "Requests timeout gracefully instead of hanging forever"

```bash
# Make a request (will auto-retry and eventually succeed or fail cleanly)
curl -v http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer invalid-token"

# Expected: Timeout error after 5 seconds (not infinite hang)
```

---

### 3. Correlation ID Propagation (3 min)

**Explain**: "Track a single request through all services"

```bash
# Make a request with custom correlation ID
TRACE_ID="demo-$(date +%s)"

curl -H "x-request-id: $TRACE_ID" \
  -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@example.com","password":"password123"}'

# Note the response includes the correlation ID
# Expected response contains: "correlationId": "$TRACE_ID"
```

**Trace Through Services**:
```bash
# Terminal: View all logs for this request
docker-compose logs | grep "$TRACE_ID"

# Expected: Same ID appears in all services:
# api-gateway: [logs with TRACE_ID]
# auth-service: [logs with TRACE_ID]
# events-service: [logs with TRACE_ID]
```

**Show Logs**:
```bash
# Pretty-print the relevant logs
docker-compose logs | grep "$TRACE_ID" | sed 's/.*\({"[^}]*}\).*/\1/' | jq '.'
```

---

### 4. Idempotency Demo (2 min)

**Explain**: "Same request made twice produces same result without duplication"

```bash
# Generate an idempotency key
IDEMPOTENT_KEY="create-event-demo-$(date +%s)"

# First request: Creates event
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $(get_token)" \
  -H "Idempotency-Key: $IDEMPOTENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Idempotent Event",
    "startDate": "2024-03-15T10:00:00Z",
    "endDate": "2024-03-15T17:00:00Z"
  }' | jq '.data.id'

# Save event ID
EVENT_ID=$(previous_response_id)

# Second request: Same key, returns cached result
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $(get_token)" \
  -H "Idempotency-Key: $IDEMPOTENT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Idempotent Event",
    "startDate": "2024-03-15T10:00:00Z",
    "endDate": "2024-03-15T17:00:00Z"
  }' | jq '.data.id'

# Verify: Both responses have same event ID
# Count events: Only one was created!
```

---

### 5. Full Workflow Demo (5 min)

**Scenario**: Create, submit, and approve an event

#### Step 1: Sign Up
```bash
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "demo@example.com",
    "password": "DemoPassword123!",
    "name": "Demo User",
    "phone": "+1-555-0100"
  }' | jq '.'

# Save the token from response
TOKEN=$(response.accessToken)
```

#### Step 2: Create Event
```bash
curl -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Demo Conference 2024",
    "description": "A demonstration event",
    "startDate": "2024-04-01T09:00:00Z",
    "endDate": "2024-04-01T17:00:00Z",
    "location": "Demo Hall, Demo City",
    "capacity": 100
  }' | jq '.data | {id, title, status}'

# Save event ID
EVENT_ID=$(response.id)
```

#### Step 3: List Events
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/events?skip=0&take=5" | jq '.data.items | length'

# Shows event was created
```

#### Step 4: Check Logs
```bash
# Show that correlation IDs were present throughout
docker-compose logs api-gateway | tail -20 | grep -o '"requestId":"[^"]*"'
```

---

### 6. Documentation Overview (2 min)

**Show the docs** (have them open in a browser tab):

1. **SETUP.md**: "One command startup"
   ```bash
   # This is how simple it is:
   docker-compose up
   ```

2. **ARCHITECTURE.md**: "System design and patterns"
   - Microservices decomposition
   - Correlation ID flow
   - Idempotency mechanism
   - Retry strategy

3. **API.md**: "Full endpoint documentation"
   - All endpoints with examples
   - Request/response formats
   - Error codes

4. **RUNBOOK.md**: "Operational procedures"
   - Troubleshooting guide
   - Monitoring commands
   - Incident response

---

## Scripted Demo Script

```bash
#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Microservices Demo ===${NC}\n"

echo -e "${GREEN}1. System Health Check${NC}"
docker-compose ps
echo ""

echo -e "${GREEN}2. Correlation ID Demo${NC}"
TRACE_ID="trace-demo-$(date +%s)"
echo "Making request with correlation ID: $TRACE_ID"

curl -s -H "x-request-id: $TRACE_ID" \
  -X GET "http://localhost:3000/api/v1/events?skip=0&take=1" \
  -H "Authorization: Bearer fake-token" | jq '.correlationId'

echo ""
echo -e "${GREEN}3. Tracing Through Services${NC}"
echo "Checking logs for correlation ID: $TRACE_ID"
docker-compose logs | grep "$TRACE_ID" | head -5

echo ""
echo -e "${GREEN}4. Retry Strategy (Creating Event)${NC}"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." # Demo token
curl -s -X POST http://localhost:3000/api/v1/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Demo Event",
    "startDate": "2024-04-01T10:00:00Z"
  }' | jq '.message'

echo ""
echo -e "${GREEN}Demo Complete!${NC}"
```

---

## Test Scenarios

### Happy Path
```bash
# 1. Signup
# 2. Login
# 3. Create event
# 4. List events
# 5. Get event details
```

### Error Scenarios
```bash
# Invalid login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com","password":"wrong"}'
# Expected: 401 Unauthorized

# Missing authorization
curl http://localhost:3000/api/v1/events
# Expected: 401 Unauthorized

# Invalid event ID
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3000/api/v1/events/invalid-id"
# Expected: 400 Bad Request
```

### Resilience Scenarios
```bash
# Timeout retry (will show retries in logs)
# Event creation with logging
curl -H "Authorization: Bearer $TOKEN" \
  -X POST http://localhost:3000/api/v1/events \
  -H "Content-Type: application/json" \
  -d '{...}' 2>&1 | tee

# Check logs for retry attempts
docker-compose logs api-gateway | grep -i "retry"
```

---

## Verification Checklist

After demo, verify:

- [ ] All services running
- [ ] Correlation IDs in logs
- [ ] Retry logic working (check logs)
- [ ] Idempotency working (same key = same result)
- [ ] API responding with correct status codes
- [ ] No error messages in logs
- [ ] Response times reasonable (< 500ms)
- [ ] Documentation is complete and accurate

---

## Quick Commands Reference

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api-gateway

# Check service status
docker-compose ps

# Restart services
docker-compose restart

# Full reset
docker-compose down -v && docker-compose up

# Make test request
curl http://localhost:3000/api/v1/health

# Execute command in container
docker-compose exec api-gateway ps aux

# View environment variables
docker-compose exec api-gateway env | sort
```

---

## Post-Demo

1. **Capture Metrics**:
   - Note startup time
   - Note request latency
   - Count any errors

2. **Gather Feedback**:
   - Ease of deployment
   - Feature clarity
   - Documentation quality

3. **Verify System State**:
   ```bash
   docker-compose ps
   docker-compose logs | tail -50 | grep -i "error"
   ```

4. **Clean Up** (if needed):
   ```bash
   docker-compose down -v
   ```

---

## Demo Environment Setup Tips

1. **Pre-warm System**: Start services 5 min before demo
2. **Have Credentials Ready**: Pre-create test user (see SETUP.md)
3. **Clear Terminal**: `clear` before each section
4. **Have Backups**: Screenshot working state, so you can reset
5. **Test Network**: Ensure stable connectivity to localhost:3000

---

## Success Metrics

✅ **System runs reliably locally with one command**
- `docker-compose up` starts everything
- No manual configuration needed

✅ **Logs can correlate a request across services**
- Correlation ID present in all service logs
- Easy to trace request flow

✅ **Docs include setup, architecture, runbook, and API usage**
- SETUP.md: Installation and startup
- ARCHITECTURE.md: System design
- RUNBOOK.md: Operations guide
- API.md: Endpoint documentation

---

## Troubleshooting During Demo

**Service won't start**: `docker-compose logs <service>`

**Port already in use**: `lsof -i :3000 && kill -9 <PID>`

**Database connection failed**: `docker-compose restart postgres`

**Forgot a token**: `curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $(curl ...)"` (use your saved token)

**Slow responses**: Check `docker-compose logs api-gateway | grep "duration_ms"`

**No correlation IDs**: Verify middleware in app.module.ts

---

See [SETUP.md](./SETUP.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [API.md](./API.md), and [RUNBOOK.md](./RUNBOOK.md) for detailed information.
