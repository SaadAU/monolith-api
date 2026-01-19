# Day 10: Cross-cutting Nest Patterns

## Overview

Day 10 focuses on implementing cross-cutting concerns using NestJS patterns: interceptors, pipes, and exception filters. These patterns centralize common logic and ensure consistent behavior across all endpoints.

## Build Steps Completed

### 1. Timing Interceptor (`X-Response-Time` header)
Added `TimingInterceptor` that measures request execution time and adds it to response headers.

### 2. Response Envelope Interceptor (Optional)
Added `ResponseEnvelopeInterceptor` that wraps successful responses in a consistent format:
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00.000Z",
    "path": "/api/resource",
    "requestId": "abc-123"
  }
}
```

### 3. Query Params Validation Pipe
Added specialized pipes for parsing and validating query parameters:
- `QueryParamsValidationPipe` - General validation with sanitization
- `ParseIntPipe` - Parse integers with bounds checking
- `ParseBoolPipe` - Parse booleans with flexible input
- `ParseEnumPipe` - Validate enum values
- `ParseArrayPipe` - Parse comma-separated or repeated query params

### 4. Improved Validation Exception Mapping
Added `ValidationExceptionFilter` for structured validation error responses:
```json
{
  "statusCode": 400,
  "error": "Validation Error",
  "message": "Validation failed for 2 field(s)",
  "details": [
    { "field": "email", "constraints": ["email must be valid"] },
    { "field": "age", "constraints": ["age must be positive"] }
  ],
  "path": "/api/users",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## NestJS Request Lifecycle

Understanding the request lifecycle is crucial for implementing cross-cutting concerns correctly.

### Request Flow Diagram

```
                         ┌─────────────────────────────────────────────────┐
                         │              INCOMING REQUEST                   │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │            1. MIDDLEWARE                        │
                         │  • Express/Fastify middleware                   │
                         │  • CorrelationIdMiddleware (adds request ID)    │
                         │  • cookieParser, cors, etc.                     │
                         │  • Runs BEFORE NestJS pipeline                  │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │            2. GUARDS                            │
                         │  • Authentication (JwtAuthGuard)                │
                         │  • Authorization (RolesGuard)                   │
                         │  • Ownership (OwnershipGuard)                   │
                         │  • Can throw UnauthorizedException/403          │
                         │  • If guard returns false → request denied      │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │         3. INTERCEPTORS (Before)                │
                         │  • TimingInterceptor (starts timer)             │
                         │  • LoggingInterceptor (logs request)            │
                         │  • Wraps the entire request handling            │
                         │  • Can transform request or short-circuit       │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │            4. PIPES                             │
                         │  • ValidationPipe (validates DTOs)              │
                         │  • ParseIntPipe, ParseUUIDPipe, etc.            │
                         │  • QueryParamsValidationPipe                    │
                         │  • Transform/validate incoming data             │
                         │  • Can throw BadRequestException                │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │        5. CONTROLLER/ROUTE HANDLER              │
                         │  • Business logic executes                      │
                         │  • Calls services                               │
                         │  • Returns response data                        │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │         6. INTERCEPTORS (After)                 │
                         │  • ResponseEnvelopeInterceptor (wraps data)     │
                         │  • TimingInterceptor (adds X-Response-Time)     │
                         │  • LoggingInterceptor (logs response)           │
                         │  • Can transform response data                  │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │         7. EXCEPTION FILTERS                    │
                         │  • ValidationExceptionFilter (400 validation)   │
                         │  • HttpExceptionFilter (HTTP errors)            │
                         │  • AllExceptionsFilter (500 catch-all)          │
                         │  • Formats error responses consistently         │
                         │  • Runs ONLY if an exception is thrown          │
                         └─────────────────────────────────────────────────┘
                                              │
                                              ▼
                         ┌─────────────────────────────────────────────────┐
                         │              OUTGOING RESPONSE                  │
                         └─────────────────────────────────────────────────┘
```

### Exception Flow

```
           Exception thrown at any point
                      │
                      ▼
    ┌─────────────────────────────────────┐
    │  ValidationExceptionFilter          │
    │  Catches: BadRequestException       │
    │  (validation errors only)           │
    └─────────────────────────────────────┘
                      │
                      │ (re-throws if not validation)
                      ▼
    ┌─────────────────────────────────────┐
    │  HttpExceptionFilter                │
    │  Catches: HttpException             │
    │  (400, 401, 403, 404, etc.)         │
    └─────────────────────────────────────┘
                      │
                      │ (if not HttpException)
                      ▼
    ┌─────────────────────────────────────┐
    │  AllExceptionsFilter                │
    │  Catches: Everything                │
    │  (unexpected errors → 500)          │
    └─────────────────────────────────────┘
```

---

## Scope and Registration

### Global vs Controller vs Method Scope

| Scope | Registration | Use Case |
|-------|-------------|----------|
| **Global** | `main.ts` or `APP_*` providers | Cross-cutting (logging, auth) |
| **Controller** | `@UseGuards()`, `@UseInterceptors()` | Module-specific behavior |
| **Method** | Same decorators on method | Endpoint-specific logic |

### Registration Order Matters

```typescript
// main.ts - Exception filters (first catches last)
app.useGlobalFilters(
  new AllExceptionsFilter(),       // Catch-all (runs last)
  new HttpExceptionFilter(),       // HTTP errors
  new ValidationExceptionFilter(), // Validation (runs first)
);

// main.ts - Interceptors (first wraps outermost)
app.useGlobalInterceptors(
  new LoggingInterceptor(logger),  // Outermost - logs everything
  new TimingInterceptor(),         // Measures handler + inner interceptors
  // new ResponseEnvelopeInterceptor(reflector), // Wraps response
);
```

---

## Implementation Details

### TimingInterceptor

```typescript
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - startTime;
        response.setHeader('X-Response-Time', `${duration}ms`);
      }),
    );
  }
}
```

### ResponseEnvelopeInterceptor (Optional)

The envelope interceptor can be skipped for specific endpoints:

```typescript
@Get('raw')
@SkipEnvelope()
getRawData() {
  return { raw: 'data' }; // Not wrapped in envelope
}
```

### Custom Pipes Usage

```typescript
// In controller
@Get()
async findAll(
  @Query('page', new ParseIntPipe({ optional: true, min: 1 })) page?: number,
  @Query('active', new ParseBoolPipe({ optional: true })) active?: boolean,
  @Query('status', new ParseEnumPipe(Status, { optional: true })) status?: Status,
  @Query('ids', new ParseArrayPipe({ itemType: 'uuid', optional: true })) ids?: string[],
) {
  // All params are properly typed and validated
}
```

---

## Best Practices

### 1. Centralize Cross-cutting Logic
- ❌ Don't: Add timing code in every controller
- ✅ Do: Use `TimingInterceptor` globally

### 2. Consistent Error Responses
All error responses follow the same structure:
```typescript
interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  path: string;
  timestamp: string;
  details?: ValidationFieldError[]; // For validation errors
}
```

### 3. Layer Responsibilities

| Layer | Responsibility | Examples |
|-------|---------------|----------|
| Middleware | Raw HTTP processing | CORS, cookies, request ID |
| Guards | Authentication/Authorization | JWT validation, role checks |
| Interceptors | Cross-cutting logic | Logging, timing, caching |
| Pipes | Data transformation/validation | DTO validation, type conversion |
| Filters | Error handling | Consistent error responses |

### 4. Testing Cross-cutting Concerns

```typescript
// Test interceptor in isolation
describe('TimingInterceptor', () => {
  it('should add X-Response-Time header', async () => {
    const interceptor = new TimingInterceptor();
    const mockResponse = { setHeader: jest.fn() };
    const context = createMockExecutionContext(mockResponse);
    
    const next = { handle: () => of({ data: 'test' }) };
    
    await interceptor.intercept(context, next).toPromise();
    
    expect(mockResponse.setHeader).toHaveBeenCalledWith(
      'X-Response-Time',
      expect.stringMatching(/^\d+ms$/),
    );
  });
});
```

---

## Files Created/Modified

### New Files
- `src/common/interceptors/timing.interceptor.ts`
- `src/common/interceptors/response-envelope.interceptor.ts`
- `src/common/pipes/query-params.pipe.ts`
- `src/common/pipes/parse-type.pipes.ts`
- `src/common/pipes/index.ts`
- `src/common/filters/validation-exception.filter.ts`

### Modified Files
- `src/common/interceptors/index.ts` - Added exports
- `src/common/filters/index.ts` - Added exports
- `src/main.ts` - Registered new global interceptors/filters

---

## Definition of Done ✅

- [x] Cross-cutting logic is centralized (not duplicated)
  - Timing in `TimingInterceptor`
  - Logging in `LoggingInterceptor`  
  - Response formatting in `ResponseEnvelopeInterceptor`
  - Validation errors in `ValidationExceptionFilter`

- [x] Error and success responses remain consistent
  - Success: `{ success: true, data: {...}, meta: {...} }`
  - Error: `{ statusCode, error, message, path, timestamp }`

- [x] Docs show where guards/pipes/interceptors run
  - Request lifecycle diagram above
  - Scope and registration documentation
  - Order of execution explained

---

## Next Steps

1. Consider enabling `ResponseEnvelopeInterceptor` globally if clients expect wrapped responses
2. Add caching interceptor for GET endpoints
3. Add rate limiting using guards or middleware
4. Consider adding request timeout interceptor
