# Runbook: Operational Procedures

## Table of Contents
1. [Daily Operations](#daily-operations)
2. [Troubleshooting](#troubleshooting)
3. [Monitoring](#monitoring)
4. [Maintenance](#maintenance)
5. [Incident Response](#incident-response)
6. [Scaling](#scaling)

---

## Daily Operations

### Starting the System

#### One-Command Startup (Recommended)
```bash
docker-compose up
```

This starts all services in the correct dependency order:
1. PostgreSQL database (waits for health check)
2. Auth service (waits for DB)
3. Events service (waits for DB)
4. API gateway (waits for all services)

#### Manual Startup (Development)
```bash
# Terminal 1: Start database
docker run -d \
  --name postgres_db \
  -e POSTGRES_USER=admin \
  -e POSTGRES_PASSWORD=admin123 \
  -e POSTGRES_DB=mydb \
  -p 5433:5432 \
  postgres:16

# Wait 10 seconds for DB to start

# Terminal 2: Build and start gateway
npm run build
npm run start:gateway

# Terminal 3: Start auth service
npm run start:auth

# Terminal 4: Start events service
npm run start:events
```

### Stopping the System

```bash
# Graceful stop (recommended)
docker-compose down

# Stop and remove all data (reset)
docker-compose down -v
```

### Checking System Health

```bash
# View all running services
docker-compose ps

# Check if API is responding
curl http://localhost:3000/health

# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f api-gateway
```

### Accessing Database

```bash
# Connect to PostgreSQL
PGPASSWORD=admin123 psql -h localhost -p 5433 -U admin -d mydb

# Useful queries
SELECT * FROM "user";
SELECT * FROM event;
SELECT COUNT(*) FROM event;

# Exit
\q
```

---

## Troubleshooting

### Service Won't Start

#### Symptom
```
ERROR: UnknownHostException: getaddrinfo ENOTFOUND auth-service
```

**Cause**: Service dependency not running

**Solution**:
```bash
# Check if all services are running
docker-compose ps

# Restart all services
docker-compose restart
```

---

### Port Already in Use

#### Symptom
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Cause**: Another service is using the port

**Solution**:
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change the port in docker-compose.yml
# ports:
#   - "3001:3000"  # Use 3001 instead
```

---

### Database Connection Failed

#### Symptom
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause**: PostgreSQL not running or credentials wrong

**Solution**:
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Check credentials in docker-compose.yml
# Default: admin / admin123

# Restart database
docker-compose restart postgres

# Wait 10 seconds, then check connection
docker-compose exec postgres pg_isready -U admin
```

---

### Logs Show Correlation ID is Missing

#### Symptom
```json
{
  "level": 30,
  "time": "2024-01-20T10:30:00.000Z",
  "msg": "Request completed"
}
```

**Expected**:
```json
{
  "level": 30,
  "time": "2024-01-20T10:30:00.000Z",
  "msg": "Request completed",
  "requestId": "req-123"
}
```

**Solution**:
1. Verify middleware is registered in `app.module.ts`
2. Check that requests are reaching the gateway
3. Verify correlation-id.middleware.ts is working:

```bash
# Make a request with custom correlation ID
curl -H "x-request-id: test-123" http://localhost:3000/api/v1/events

# Check logs for: "requestId": "test-123"
docker-compose logs api-gateway | grep test-123
```

---

### Retries Not Working

#### Symptom
Service calls fail immediately without retrying

**Solution**:
1. Check `retry.utility.ts` is imported in gateway.service.ts
2. Verify `applyRetryLogic` is wrapping all RPC calls
3. Test manually:

```bash
# Make a request while stopping a service
# Should still succeed due to retries
docker-compose stop auth-service
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test123"}'

# Should either succeed (if retried) or timeout (if retries failed)
```

---

### High Memory Usage

#### Symptom
```
USAGE          MEM USAGE
7.8%           1.2GB
```

**Solution**:
```bash
# Clean up unused images/containers
docker system prune -a

# Remove all stopped containers
docker container prune

# Check memory per service
docker stats

# Restart services to clear memory leaks
docker-compose restart
```

---

## Monitoring

### Real-Time Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api-gateway

# Specific service with timestamps
docker-compose logs -f --timestamps api-gateway

# Last 100 lines
docker-compose logs --tail=100 api-gateway
```

### Log Files

Logs are also written to the filesystem:

```bash
# Check logs directory
ls -la logs/

# View app.log
tail -f logs/app.log | grep "requestId"

# Search logs
grep "ERROR" logs/app.log
grep "req-123" logs/app.log  # Find specific request
```

### Correlation ID Tracking

Follow a single request through all services:

```bash
# Make a request with custom ID
curl -H "x-request-id: trace-abc" http://localhost:3000/api/v1/events

# View all logs for that request
docker-compose logs | grep trace-abc

# Expected output across services:
# api-gateway: trace-abc
# auth-service: trace-abc
# events-service: trace-abc
```

### Service Health Checks

```bash
# API Gateway health
curl http://localhost:3000/health

# Database health
docker-compose exec postgres pg_isready -U admin

# Check microservice startup
docker-compose logs auth-service | grep -i "listening\|started"
```

---

## Maintenance

### Database Maintenance

#### Backup
```bash
# Export database
docker-compose exec postgres pg_dump -U admin mydb > backup.sql

# Verify backup
ls -lh backup.sql
```

#### Restore
```bash
# Drop current DB
docker-compose exec postgres dropdb -U admin mydb

# Create new DB
docker-compose exec postgres createdb -U admin mydb

# Restore from backup
docker-compose exec -T postgres psql -U admin mydb < backup.sql
```

#### Cleanup
```bash
# Analyze query performance
docker-compose exec postgres vacuumdb -U admin mydb

# Reindex tables (if performance degrades)
docker-compose exec postgres reindexdb -U admin mydb
```

### Resetting Database

```bash
# Option 1: Soft reset (keep images)
docker-compose down -v  # -v removes volumes
docker-compose up

# Option 2: Hard reset (rebuild everything)
docker-compose down -v
docker system prune -a
docker-compose up --build
```

### Seed Data Management

```bash
# Seed database with sample data
npm run db:seed

# Clear all data
npm run db:reset

# View seed file
cat src/database/seed.ts
```

---

## Incident Response

### Service Crashes

#### Detect
```bash
docker-compose ps

# Look for "Exit" status instead of "Up"
```

#### Respond
```bash
# View crash logs
docker-compose logs api-gateway --tail=50

# Restart the service
docker-compose restart api-gateway

# Monitor for stability (5 minutes)
watch -n 1 'docker-compose ps'
```

#### Debug
```bash
# Get full error stack
docker-compose logs api-gateway | grep -A 20 "ERROR\|Exception"

# Check disk space (may cause crashes)
docker system df

# Check container resource limits
docker inspect <container_id> | grep Memory
```

---

### Database Connection Pool Exhaustion

#### Symptom
```
Error: ECONNREFUSED - no more connections available
```

**Solution**:
```bash
# Check active connections
docker-compose exec postgres psql -U admin -d mydb \
  -c "SELECT count(*) FROM pg_stat_activity;"

# Kill idle connections
docker-compose exec postgres psql -U admin -d mydb \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity 
      WHERE state = 'idle' AND datname = 'mydb';"

# Restart database
docker-compose restart postgres
```

---

### Slow Requests

#### Monitor
```bash
# Enable timing logs (already enabled for gateway)
docker-compose logs api-gateway | grep "duration_ms"

# Check slow queries in logs
docker-compose logs | grep "duration_ms" | grep -E "[0-9]{4,}"
```

#### Diagnose
```bash
# Check which queries are slow
docker-compose exec postgres psql -U admin -d mydb \
  -c "SELECT query, calls, mean_time FROM pg_stat_statements 
      ORDER BY mean_time DESC LIMIT 10;"

# Analyze table
docker-compose exec postgres psql -U admin -d mydb \
  -c "ANALYZE event; ANALYZE \"user\";"

# Check table sizes
docker-compose exec postgres psql -U admin -d mydb \
  -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
      FROM pg_tables ORDER BY pg_total_relation_size DESC;"
```

---

### High Error Rate

#### Detect
```bash
# Monitor errors in real-time
docker-compose logs -f api-gateway | grep -i error

# Count errors in the last hour
docker-compose logs api-gateway --since 1h | grep -i error | wc -l
```

#### Investigate
```bash
# Check for service availability
curl -v http://localhost:3000/health
docker-compose exec auth-service curl localhost:3002/health

# Check microservice connectivity
docker-compose exec api-gateway ping auth-service
docker-compose exec api-gateway ping events-service

# Check logs for specific errors
docker-compose logs api-gateway | grep -i "timeout\|refused\|failed"
```

#### Recover
```bash
# If a service is flaky, restart it
docker-compose restart auth-service

# If database is slow, restart it
docker-compose restart postgres

# If all else fails, full restart
docker-compose restart
```

---

## Scaling

### Vertical Scaling (Larger Container)

Edit `docker-compose.yml`:

```yaml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

Then restart:
```bash
docker-compose up -d
```

### Horizontal Scaling (Multiple Instances)

For production deployment with Kubernetes:

```yaml
# In k8s manifest
replicas: 3
resources:
  limits:
    cpu: 500m
    memory: 512Mi
```

### Database Optimization

```bash
# Add indexes for frequently queried fields
docker-compose exec postgres psql -U admin -d mydb << 'EOF'
CREATE INDEX idx_event_org_id ON event(orgId);
CREATE INDEX idx_event_status ON event(status);
CREATE INDEX idx_user_email ON "user"(email);
EOF

# Verify indexes
docker-compose exec postgres psql -U admin -d mydb \
  -c "\d event"  # Shows indexes
```

### Cache Optimization (Future)

```bash
# Redis cache for idempotency (instead of in-memory)
# Would significantly improve production reliability
```

---

## SLA & Targets

| Metric | Target | Current |
|--------|--------|---------|
| Availability | 99.9% | Dev only |
| Response Time (p95) | < 500ms | ~200ms |
| Error Rate | < 0.1% | Monitoring |
| Startup Time | < 30s | ~10s |

---

## Escalation

1. **Self-Service**: Check this runbook and restart services
2. **First Responder**: Check logs and database health
3. **Database Team**: For data corruption or major issues
4. **DevOps**: For infrastructure/Docker issues
5. **Engineering Lead**: For architectural decisions

---

## Related Documents

- [SETUP.md](./SETUP.md) - Initial setup instructions
- [API.md](./API.md) - API endpoint documentation
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
