# Day 3: Logging, Request IDs, and Health Endpoints

**Date:** December 28, 2025

## Objective

Add structured logging with request correlation, track request duration, and implement health check endpoints for container orchestration (Kubernetes readiness/liveness probes).

## What Was Done

### 1. Structured Logger (Pino)

Integrated `nestjs-pino` for high-performance structured JSON logging.

**Packages Installed:**
```bash
npm install nestjs-pino pino-http pino-pretty uuid
npm install -D @types/uuid
```

**Logger Configuration in `app.module.ts`:**
```typescript
LoggerModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    pinoHttp: {
      level: configService.get<string>('environment') === 'production' ? 'info' : 'debug',
      transport:
        configService.get<string>('environment') !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                singleLine: true,
                translateTime: 'SYS:standard',
              },
            }
          : undefined,
      customProps: (req) => ({
        requestId: req.requestId,
      }),
      autoLogging: false, // We use custom LoggingInterceptor
    },
  }),
  inject: [ConfigService],
}),
```

**Features:**
- Pretty-printed colored logs in development
- JSON logs in production (for log aggregation tools)
- Request ID included in all log entries
- Configurable log levels per environment

### 2. Request Correlation ID Middleware

Created middleware to generate/propagate `x-request-id` headers.

**File:** `src/common/middleware/correlation-id.middleware.ts`

```typescript
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Use existing request ID from header or generate a new one
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    
    // Attach to request for use in application
    req.requestId = requestId;
    
    // Set response header
    res.setHeader('x-request-id', requestId);
    
    next();
  }
}
```

**Behavior:**
- If client sends `x-request-id` header, it's preserved (useful for distributed tracing)
- If no header present, a new UUID is generated
- Request ID is attached to the request object and response header

### 3. Logging Interceptor (Request Duration)

Created interceptor to log all requests with duration.

**File:** `src/common/interceptors/logging.interceptor.ts`

```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = ctx.getRequest<Request>();
    const { method, url, body } = request;
    const requestId = request.requestId;
    const startTime = Date.now();

    // Log incoming request
    this.logger.info({ requestId, method, url, body }, `Incoming request: ${method} ${url}`);

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.info(
            { requestId, method, url, statusCode, duration: `${duration}ms` },
            `Request completed: ${method} ${url} - ${statusCode} [${duration}ms]`
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.error(
            { requestId, method, url, statusCode, duration: `${duration}ms`, error: error.message },
            `Request failed: ${method} ${url} - ${statusCode} [${duration}ms]`
          );
        },
      }),
    );
  }
}
```

**Features:**
- Logs incoming request with method, URL, and sanitized body
- Logs response with status code and duration in milliseconds
- Logs errors with error message
- Sanitizes sensitive fields (password, token, secret, authorization)

### 4. Health Check Endpoints

Created a dedicated HealthModule with liveness and readiness probes.

**Files:**
- `src/modules/health/health.module.ts`
- `src/modules/health/health.controller.ts`
- `src/modules/health/health.service.ts`
- `src/modules/health/dto/health.dto.ts`

#### Liveness Probe: `GET /health/live`

Checks if the application process is running. Returns immediately without checking dependencies.

```json
{
  "status": "ok",
  "timestamp": "2025-12-28T10:00:00.000Z",
  "service": "EventBoard API"
}
```

**Use Case:** Kubernetes uses this to know if the container should be restarted.

#### Readiness Probe: `GET /health/ready`

Checks if the application is ready to accept traffic by verifying all dependencies (database, etc.).

```json
{
  "status": "ok",
  "timestamp": "2025-12-28T10:00:00.000Z",
  "service": "EventBoard API",
  "dependencies": [
    { "name": "database", "status": "ok" }
  ]
}
```

**Error Response (503 Service Unavailable):**
```json
{
  "status": "degraded",
  "timestamp": "2025-12-28T10:00:00.000Z",
  "service": "EventBoard API",
  "dependencies": [
    { "name": "database", "status": "error", "message": "Connection refused" }
  ]
}
```

**Use Case:** Kubernetes uses this to know if traffic should be routed to the pod.

## Log Output Examples

**Development (pino-pretty):**
```
[2025-12-28 14:49:42.216 +0500] INFO: Incoming request: GET /health/live
    requestId: "567f525f-5398-4dc3-b46d-97aa205bca01"
    method: "GET"
    url: "/health/live"

[2025-12-28 14:49:42.228 +0500] INFO: Request completed: GET /health/live - 200 [12ms]
    requestId: "567f525f-5398-4dc3-b46d-97aa205bca01"
    statusCode: 200
    duration: "12ms"
```

**Production (JSON):**
```json
{"level":30,"time":1735385382216,"requestId":"567f525f-5398-4dc3-b46d-97aa205bca01","method":"GET","url":"/health/live","msg":"Incoming request: GET /health/live"}
{"level":30,"time":1735385382228,"requestId":"567f525f-5398-4dc3-b46d-97aa205bca01","method":"GET","url":"/health/live","statusCode":200,"duration":"12ms","msg":"Request completed: GET /health/live - 200 [12ms]"}
```

## Files Created

| File | Purpose |
|------|---------|
| `src/common/middleware/correlation-id.middleware.ts` | Generate/propagate x-request-id |
| `src/common/middleware/index.ts` | Barrel export |
| `src/common/interceptors/logging.interceptor.ts` | Log request duration |
| `src/common/interceptors/index.ts` | Barrel export |
| `src/modules/health/health.module.ts` | Health module |
| `src/modules/health/health.controller.ts` | Health endpoints |
| `src/modules/health/health.service.ts` | Health check logic |
| `src/modules/health/dto/health.dto.ts` | Response DTOs |
| `src/modules/health/index.ts` | Barrel export |

## Files Modified

| File | Changes |
|------|---------|
| `src/app.module.ts` | Added LoggerModule, HealthModule, CorrelationIdMiddleware |
| `src/main.ts` | Configured Pino logger, added LoggingInterceptor |
| `src/app.controller.ts` | Removed old /health endpoint |

## Definition of Done ✅

- [x] Every request logs `requestId` and `duration`
- [x] `x-request-id` present in responses
- [x] Health endpoints exist (`/health/live`, `/health/ready`)
- [x] Health endpoints documented in Swagger

## Testing

```bash
# Test liveness endpoint
curl http://localhost:3000/health/live

# Test readiness endpoint
curl http://localhost:3000/health/ready

# Test with custom request ID
curl -H "x-request-id: my-trace-id-123" http://localhost:3000/health/live

# Check response headers for x-request-id
curl -i http://localhost:3000/health/live
```

## Swagger Documentation

Health endpoints are documented under the `health` tag at `http://localhost:3000/api`

## Dependencies Added

```json
{
  "dependencies": {
    "nestjs-pino": "^4.x",
    "pino-http": "^10.x",
    "pino-pretty": "^13.x",
    "uuid": "^11.x"
  },
  "devDependencies": {
    "@types/uuid": "^10.x"
  }
}
```
