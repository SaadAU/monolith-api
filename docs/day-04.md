# Day 4: Database, Migrations, and Seeds

**Date:** December 29, 2025

## Objective

Set up PostgreSQL database with Docker Compose, create Organization and User schemas with proper constraints and relationships, and implement seed scripts for local development.

## What Was Done

### 1. Docker Compose PostgreSQL (Already Completed)

PostgreSQL database running via Docker Compose on port 5433.

```yaml
# docker-compose.yml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: admin123
      POSTGRES_DB: mydb
    ports:
      - "5433:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### 2. TypeORM Configuration (Already Completed)

TypeORM configured in `app.module.ts` with PostgreSQL connection.

```typescript
TypeOrmModule.forRootAsync({
  imports: [ConfigModule],
  useFactory: (configService: ConfigService) => ({
    type: 'postgres',
    host: configService.get<string>('database.host'),
    port: configService.get<number>('database.port'),
    username: configService.get<string>('database.username'),
    password: configService.get<string>('database.password'),
    database: configService.get<string>('database.name'),
    entities: [__dirname + '/**/*.entity{.ts,.js}'],
    synchronize: configService.get<string>('environment') !== 'production',
  }),
  inject: [ConfigService],
}),
```

### 3. Organization Entity

Created `Org` entity with proper constraints and indexes.

**File:** `src/modules/orgs/entities/org.entity.ts`

```typescript
@Entity('orgs')
export class Org {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 50, unique: true })
  @Index({ unique: true })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 255, nullable: true })
  website?: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({ length: 255, nullable: true })
  address?: string;

  @Column({ default: true })
  @Index()
  isActive!: boolean;

  @OneToMany(() => User, (user) => user.org)
  users!: User[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

**Database Schema:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL, INDEXED |
| slug | VARCHAR(50) | NOT NULL, UNIQUE, INDEXED |
| description | TEXT | NULLABLE |
| website | VARCHAR(255) | NULLABLE |
| phone | VARCHAR(20) | NULLABLE |
| address | VARCHAR(255) | NULLABLE |
| isActive | BOOLEAN | DEFAULT true, INDEXED |
| createdAt | TIMESTAMP | AUTO |
| updatedAt | TIMESTAMP | AUTO |

### 4. User Entity

Created `User` entity with role enum and foreign key relationship to Org.

**File:** `src/modules/users/entities/user.entity.ts`

```typescript
export enum UserRole {
  ADMIN = 'admin',
  ORGANIZER = 'organizer',
  MEMBER = 'member',
}

@Entity('users')
@Index(['orgId', 'email'], { unique: true }) // Unique email per org
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 100 })
  @Index()
  name!: string;

  @Column({ length: 255 })
  @Index()
  email!: string;

  @Column({ length: 255, select: false }) // Never return password
  passwordHash!: string;

  @Column({ length: 20, nullable: true })
  phone?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.MEMBER,
  })
  @Index()
  role!: UserRole;

  @Column({ type: 'uuid' })
  @Index()
  orgId!: string;

  @ManyToOne(() => Org, (org) => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orgId' })
  org!: Org;

  @Column({ default: true })
  @Index()
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
```

**Database Schema:**
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PRIMARY KEY |
| name | VARCHAR(100) | NOT NULL, INDEXED |
| email | VARCHAR(255) | NOT NULL, INDEXED |
| passwordHash | VARCHAR(255) | NOT NULL, HIDDEN |
| phone | VARCHAR(20) | NULLABLE |
| role | ENUM | DEFAULT 'member', INDEXED |
| orgId | UUID | FOREIGN KEY → orgs.id, INDEXED |
| isActive | BOOLEAN | DEFAULT true, INDEXED |
| lastLoginAt | TIMESTAMP | NULLABLE |
| createdAt | TIMESTAMP | AUTO |
| updatedAt | TIMESTAMP | AUTO |

**Composite Unique Constraint:** `(orgId, email)` — Same email can exist in different organizations.

### 5. Entity Relationship

```
┌─────────────┐          ┌─────────────┐
│    orgs     │          │    users    │
├─────────────┤          ├─────────────┤
│ id (PK)     │◄────────┤│ orgId (FK)  │
│ name        │  1    *  │ id (PK)     │
│ slug        │          │ name        │
│ users[]     │          │ email       │
└─────────────┘          │ role        │
                         │ org         │
                         └─────────────┘

One Organization has Many Users
Each User belongs to One Organization
CASCADE DELETE: Deleting an org deletes all its users
```

### 6. DTOs with Validation

**Create Org DTO:** `src/modules/orgs/dto/create-org.dto.ts`
```typescript
export class CreateOrgDto {
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsNotEmpty()
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/)  // URL-friendly slug
  slug!: string;

  @IsOptional()
  @IsUrl()
  website?: string;
  // ... more fields
}
```

**Create User DTO:** `src/modules/users/dto/create-user.dto.ts`
```typescript
export class CreateUserDto {
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)  // Strong password
  password!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsNotEmpty()
  @IsUUID()
  orgId!: string;
}
```

### 7. Service Layer

**Orgs Service:** `src/modules/orgs/services/orgs.service.ts`
- `create()` - Creates org, checks for slug conflicts
- `findAll()` - Returns active orgs sorted by name
- `findOne()` - Gets org by ID with users relation
- `findBySlug()` - Gets org by URL slug
- `update()` - Updates org, validates slug uniqueness
- `remove()` - Hard deletes org
- `deactivate()` - Soft deletes (sets isActive = false)

**Users Service:** `src/modules/users/services/users.service.ts`
- `create()` - Creates user with password hashing
- `findAll()` - Returns users (optionally filtered by orgId)
- `findOne()` - Gets user by ID with org relation
- `findByEmail()` - Gets user by email within an org
- `update()` - Updates user (cannot change password/org)
- `remove()` - Hard deletes user
- `deactivate()` - Soft deletes user
- `updateLastLogin()` - Updates last login timestamp

### 8. API Endpoints

**Organizations (`/orgs`):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/orgs` | Create organization (protected, admin-only) |
| GET | `/orgs` | List all active organizations (protected) |
| GET | `/orgs/:id` | Get organization by ID (includes users) (protected) |
| GET | `/orgs/slug/:slug` | Get organization by URL slug (protected) |
| PATCH | `/orgs/:id` | Update organization (protected, admin/org-admin) |
| DELETE | `/orgs/:id` | Delete organization (hard delete) (protected, admin-only) |
| PATCH | `/orgs/:id/deactivate` | Deactivate organization (soft delete) (protected, admin/org-admin) |

**Users (`/users`):**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/users` | Create user (protected, admin/org-admin) |
| GET | `/users` | List all active users (protected) |
| GET | `/users?orgId=:id` | List users filtered by organization (protected) |
| GET | `/users/:id` | Get user by ID (protected: self or admin/org-admin) |
| PATCH | `/users/:id` | Update user (protected: self or admin/org-admin) |
| DELETE | `/users/:id` | Delete user (hard delete) (protected, admin/org-admin) |
| PATCH | `/users/:id/deactivate` | Deactivate user (soft delete) (protected, admin/org-admin) |

#### Security for `/orgs` and `/users` endpoints

All organization and user management routes **must not** be exposed as public, unauthenticated endpoints:

- Protect all `/orgs` and `/users` routes with an authentication mechanism (for example, a JWT auth guard).
- Apply role-based authorization guards so that only authorized roles (for example, `admin` or `org_admin`, and the user themself where appropriate) can access these endpoints.
- When deploying, ensure these guards are enabled and that the service is never reachable from untrusted networks without authentication and authorization in place.
### 9. Seed Script

**File:** `src/database/seed.ts`

```bash
npm run db:seed
```

**Creates Test Data:**
| Type | Count | Details |
|------|-------|---------|
| Organizations | 3 | Acme Corp, TechStart Inc, Global Events Ltd |
| Users | 6 | 3 admins, 1 organizer, 2 members |
| Students | 3 | Alice, Bob, Charlie |

**Test Credentials:**
| Email | Password | Role | Organization |
|-------|----------|------|--------------|
| admin@acme.com | Admin123! | admin | Acme Corporation |
| john@acme.com | Organizer123! | organizer | Acme Corporation |
| jane@acme.com | Member123! | member | Acme Corporation |
| admin@techstart.com | Admin123! | admin | TechStart Inc |
| sarah@techstart.com | Developer123! | member | TechStart Inc |
| manager@globalevents.com | Manager123! | admin | Global Events Ltd |

### 10. Reset Script

**File:** `src/database/reset.ts`

```bash
npm run db:reset
```

Drops all tables (users, orgs, students) for a clean slate. Run this before re-seeding.

## NPM Scripts Added

```json
{
  "scripts": {
    "db:seed": "ts-node src/database/seed.ts",
    "db:reset": "ts-node src/database/reset.ts"
  }
}
```

## File Structure

```
src/modules/
├── orgs/
│   ├── entities/
│   │   └── org.entity.ts
│   ├── dto/
│   │   ├── create-org.dto.ts
│   │   ├── update-org.dto.ts
│   │   └── index.ts
│   ├── services/
│   │   └── orgs.service.ts
│   ├── controllers/
│   │   └── orgs.controller.ts
│   ├── orgs.module.ts
│   └── index.ts
├── users/
│   ├── entities/
│   │   └── user.entity.ts
│   ├── dto/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   └── index.ts
│   ├── services/
│   │   └── users.service.ts
│   ├── controllers/
│   │   └── users.controller.ts
│   ├── users.module.ts
│   └── index.ts
src/database/
├── seed.ts
└── reset.ts
```

## Testing the Implementation

### 1. Start the Application
```bash
docker compose up -d    # Start PostgreSQL
npm run start:dev       # Start NestJS (creates tables via synchronize)
```

### 2. Seed the Database
```bash
npm run db:seed
```

### 3. Test via Swagger UI
Open http://localhost:3000/api

### 4. Example API Calls

**Create Organization:**
```bash
POST /orgs
{
  "name": "New Company",
  "slug": "new-company",
  "description": "A new organization"
}
```

**Create User:**
```bash
POST /users
{
  "name": "New User",
  "email": "user@newcompany.com",
  "password": "SecurePass123",
  "role": "member",
  "orgId": "11111111-1111-1111-1111-111111111111"
}
```

**Get Users by Organization:**
```bash
GET /users?orgId=11111111-1111-1111-1111-111111111111
```

## Definition of Done ✅

- [x] Fresh setup: migrate + seed works
- [x] Ready check validates DB connectivity (`/health/ready`)
- [x] Org table exists with indexes/constraints
- [x] User table exists with indexes/constraints
- [x] Foreign key relationship: User → Org
- [x] Unique composite index: (orgId, email)
- [x] Seed script creates test data
- [x] All endpoints documented in Swagger

## Security Notes

⚠️ **Password Hashing:** Use a dedicated password hashing algorithm (for example, `bcrypt`); do **not** use fast, unsalted hashes like SHA256 for storing passwords.

```bash
npm install bcrypt
npm install -D @types/bcrypt
```

```typescript
import * as bcrypt from 'bcrypt';

// Hash password
const hash = await bcrypt.hash(password, 10);

// Verify password
const isMatch = await bcrypt.compare(password, hash);
```

## Next Steps (Day 5)

- Implement JWT authentication
- Add login/register endpoints
- Protect routes with Guards
- Add role-based access control (RBAC)
