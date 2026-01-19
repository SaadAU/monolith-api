# Day 2: DTOs, Validation, and Consistent Errors

**Date:** December 26, 2025

## Objective

Implement robust validation and consistent error handling across the API.

## What Was Done

### 1. Global ValidationPipe Configuration

Enhanced the ValidationPipe in `main.ts` with strict settings:

```typescript
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Strip properties not in DTO
    forbidNonWhitelisted: true,   // Reject unknown properties with 400
    transform: true,              // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true, // Convert query params to proper types
    },
  }),
);
```

### 2. Global Exception Filters

Created consistent error response format across all API errors.

**Files Created:**
- `src/common/filters/http-exception.filter.ts` - Handles HTTP exceptions
- `src/common/filters/all-exceptions.filter.ts` - Catches unhandled errors
- `src/common/filters/index.ts` - Barrel export

**Standard Error Response Shape:**
```typescript
interface ErrorResponse {
  statusCode: number;    // HTTP status code
  error: string;         // Error type (e.g., "Bad Request")
  message: string | string[];  // Validation messages or error description
  path: string;          // Request URL
  timestamp: string;     // ISO timestamp
}
```

**Example Error Response:**
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "Name cannot exceed 100 characters",
    "Please provide a valid email address"
  ],
  "path": "/students",
  "timestamp": "2025-12-26T15:30:00.000Z"
}
```

### 3. Enhanced DTO Validation

Updated `CreateStudentDto` with comprehensive validation rules:

| Field | Validations |
|-------|-------------|
| **name** | Required, 3-100 chars, letters/spaces/hyphens/apostrophes only |
| **email** | Required, valid email format, max 255 chars |
| **phone** | Optional, max 20 chars, digits/+/()-/spaces only |
| **enrollmentNumber** | Required, 3-50 chars |

**Decorators Used:**
- `@IsNotEmpty()` - Field must not be empty
- `@IsString()` - Must be a string
- `@IsEmail()` - Valid email format
- `@IsOptional()` - Field is optional
- `@MinLength(n)` - Minimum character length
- `@MaxLength(n)` - Maximum character length
- `@Matches(regex)` - Custom pattern validation

### 4. Swagger Documentation Enhanced

Added examples and constraints to API documentation:

```typescript
@ApiProperty({ 
  description: 'Student full name', 
  minLength: 3, 
  maxLength: 100, 
  example: 'John Doe' 
})
```

## Files Modified

- `src/main.ts` - Added global filters and enhanced ValidationPipe
- `src/modules/students/dto/create-student.dto.ts` - Enhanced validation rules

## Files Created

- `src/common/filters/http-exception.filter.ts`
- `src/common/filters/all-exceptions.filter.ts`
- `src/common/filters/index.ts`

## Verification

### 1. Invalid Payload Returns 400 with Details

```bash
# Missing required field + invalid email
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{"name":"Jo","email":"invalid"}'
```

Expected response:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": [
    "Name must be at least 3 characters",
    "Please provide a valid email address",
    "Enrollment number is required"
  ],
  "path": "/students",
  "timestamp": "2025-12-26T..."
}
```

### 2. Unknown Fields Are Rejected (forbidNonWhitelisted)

```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@test.com","enrollmentNumber":"ENR001","unknownField":"test"}'
```

Expected response:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["property unknownField should not exist"],
  "path": "/students",
  "timestamp": "2025-12-26T..."
}
```

### 3. Max Length Validation

```bash
curl -X POST http://localhost:3000/students \
  -H "Content-Type: application/json" \
  -d '{"name":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","email":"test@test.com","enrollmentNumber":"ENR001"}'
```

Expected response includes: `"Name cannot exceed 100 characters"`

### 4. Swagger UI Shows Routes

Navigate to: http://localhost:3000/api

- All endpoints visible with documentation
- Request/response schemas shown
- Examples populated in forms

## Definition of Done ✓

- [x] Global ValidationPipe configured (transform + whitelist)
- [x] Global exception filter with consistent error response
- [x] Swagger base config (title/version) in place
- [x] Invalid payload returns 400 with details
- [x] Unknown fields are rejected (forbidNonWhitelisted)
- [x] Error shape matches documented format
- [x] Swagger loads and shows routes at `/api`
- [x] DTO validation includes max length constraints
- [x] Custom error messages for better UX

## Packages Used

```json
{
  "class-validator": "^0.14.3",
  "class-transformer": "^0.5.x",
  "@nestjs/swagger": "^11.2.3"
}
```

## Next Steps (Day 3)

- Add authentication module (JWT)
- Implement authorization guards
- Add request logging interceptor
- Create additional feature modules (Events, Users)
