# Day 1: Bootstrap the Monolith

**Date:** December 26, 2025

## Objective

Set up the foundational NestJS monolith API with proper project structure, configuration, and development tooling.

## What Was Done

### 1. NestJS Application Setup

- Created NestJS application using `@nestjs/cli`
- Configured strict TypeScript settings for type safety
- Set up ESLint and Prettier for code quality

### 2. Configuration Module

- Installed `@nestjs/config` for environment-based configuration
- Created centralized configuration at `src/config/configuration.ts`
- Made ConfigModule globally available

### 3. Health Endpoint

- Added `/health` endpoint in `AppController`
- Returns status, timestamp, and service name
- Used for monitoring and deployment readiness checks

### 4. Project Structure

Created the following directory structure for scalability:

```
src/
├── config/              # App configuration
├── common/              # Cross-cutting concerns
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Logging, transform interceptors
│   └── pipes/           # Validation pipes
└── modules/             # Feature modules
    ├── auth/            # Authentication
    ├── events/          # Event management
    ├── moderation/      # Content moderation
    ├── orgs/            # Organizations
    └── users/           # User management
```

### 5. TypeScript Configuration

Enabled strict mode with the following settings:
- `strict: true` - Enables all strict type-checking options
- `noImplicitReturns: true` - Ensure functions return on all paths
- `noUnusedLocals: true` - Report unused local variables
- `noUnusedParameters: true` - Report unused parameters

### 6. Database Setup (SQLite)

- Installed TypeORM with `better-sqlite3` driver for local development
- Configured TypeORM in `app.module.ts` with auto-sync for development
- Database file: `eventboard.db` (created automatically)

```typescript
TypeOrmModule.forRoot({
  type: 'better-sqlite3',
  database: 'eventboard.db',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  synchronize: process.env.NODE_ENV !== 'production',
})
```

### 7. Students Module (CRUD)

Created a complete Students feature module with:

**Entity:** `src/modules/students/entities/student.entity.ts`
- UUID primary key
- Fields: name, email (unique), phone, enrollmentNumber, isActive
- Auto timestamps: createdAt, updatedAt

**DTOs:**
- `CreateStudentDto` - with validation decorators (class-validator)
- `UpdateStudentDto` - extends CreateStudentDto with PartialType

**Service:** Full CRUD operations with TypeORM Repository pattern

**Controller:** RESTful endpoints:
- `POST /students` - Create student
- `GET /students` - List all students
- `GET /students/:id` - Get student by ID
- `PATCH /students/:id` - Update student
- `DELETE /students/:id` - Delete student

### 8. Swagger UI Integration

- Configured Swagger in `main.ts` using `@nestjs/swagger`
- Added API documentation decorators to DTOs and controllers
- Enabled global ValidationPipe with class-transformer

**Access Swagger UI:** http://localhost:3000/api

## How to Run

```bash
# Navigate to the monolith-api directory
cd apps/monolith-api

# Install dependencies
npm install

# Start the development server
npm run start:dev
```

## Verification

1. **Application starts successfully:**
   ```bash
   npm run start:dev
   ```
   Expected output: `Nest application successfully started`

2. **Health check returns 200:**
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response:
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-12-26T...",
     "service": "EventBoard API"
   }
   ```

3. **Swagger UI accessible:**
   ```
   http://localhost:3000/api
   ```

4. **Students API works:**
   ```bash
   # Create a student
   curl -X POST http://localhost:3000/students \
     -H "Content-Type: application/json" \
     -d '{"name":"John Doe","email":"john@example.com","enrollmentNumber":"ENR001"}'

   # List students
   curl http://localhost:3000/students
   ```

5. **Lint passes:**
   ```bash
   npm run lint
   ```

6. **Format check:**
   ```bash
   npm run format
   ```

## Definition of Done ✓

- [x] App starts locally with one command (`npm run start:dev`)
- [x] `/health` returns 200
- [x] Repo has lint/format scripts
- [x] Readable README with run instructions
- [x] Day-01 notes documented
- [x] Database configured (SQLite for local dev)
- [x] Students CRUD module implemented
- [x] Swagger UI integrated at `/api`
- [x] Validation enabled with class-validator

## Packages Installed

```json
{
  "@nestjs/typeorm": "^11.0.0",
  "@nestjs/swagger": "^11.2.3",
  "typeorm": "^0.3.28",
  "better-sqlite3": "^11.x",
  "class-validator": "^0.14.3",
  "class-transformer": "^0.5.x"
}
```

## Next Steps (Day 2)

- Add more feature modules (Events, Users, Orgs)
- Implement authentication with JWT
- Add error handling and response interceptors
- Consider migrating to PostgreSQL for production
