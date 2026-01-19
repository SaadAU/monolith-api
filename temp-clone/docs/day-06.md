# Day 6: RBAC Authorization (Roles/Policies)

## Overview

Day 6 implements Role-Based Access Control (RBAC) for the EventBoard API. This provides fine-grained authorization based on user roles, distinguishing between authentication (who you are) and authorization (what you can do).

## What Was Implemented

### 1. User Roles Enum

Updated the `UserRole` enum with three roles:

```typescript
// src/modules/users/entities/user.entity.ts
export enum UserRole {
  ADMIN = 'admin',       // Full access to all resources
  MODERATOR = 'moderator', // Can manage content and moderate users
  USER = 'user',         // Standard user with basic access
}
```

### 2. @Roles Decorator

Created a custom decorator to specify required roles for route handlers:

```typescript
// src/modules/auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

// Usage: @Roles(UserRole.ADMIN) or @Roles(UserRole.ADMIN, UserRole.MODERATOR)
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### 3. RolesGuard

Implemented a guard that checks user roles against required roles:

```typescript
// src/modules/auth/guards/roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('Access denied: User not authenticated');
    }

    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied: Required role(s): ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
```

### 4. Protected Routes

Applied RBAC to controllers:

#### Users Controller
| Route | Method | Required Roles |
|-------|--------|----------------|
| `/users` | POST | Admin only |
| `/users` | GET | Admin, Moderator |
| `/users/:id` | GET | Any authenticated user |
| `/users/:id` | PATCH | Admin, Moderator |
| `/users/:id` | DELETE | Admin only |
| `/users/:id/deactivate` | PATCH | Admin, Moderator |

#### Organizations Controller
| Route | Method | Required Roles | Org Restriction |
|-------|--------|----------------|-----------------|
| `/orgs` | POST | Admin only | None |
| `/orgs` | GET | Any authenticated user | None |
| `/orgs/:id` | GET | Any authenticated user | None |
| `/orgs/slug/:slug` | GET | Any authenticated user | None |
| `/orgs/:id` | PATCH | Admin only | **Own org only** |
| `/orgs/:id` | DELETE | Admin only | **Own org only** |
| `/orgs/:id/deactivate` | PATCH | Admin only | **Own org only** |

### 5. Multi-Tenant Organization Isolation

Added org-level authorization to prevent admins from modifying other organizations:

```typescript
// src/modules/orgs/controllers/orgs.controller.ts
@Delete(':id')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
remove(
  @Param('id', ParseUUIDPipe) id: string,
  @CurrentUser() user: User,
): Promise<void> {
  if (user.orgId !== id) {
    throw new ForbiddenException('You can only delete your own organization');
  }
  return this.orgsService.remove(id);
}
```

**Security Scenario:**
- Admin of "Acme Corp" (`orgId: 11111111-...`) tries to delete "TechStart Inc" (`orgId: 22222222-...`)
- ❌ Returns `403 Forbidden: You can only delete your own organization`
- ✅ Can only delete their own org (`11111111-...`)

## Usage Examples

### Protecting a Route (Admin Only)

```typescript
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiBearerAuth()
@ApiOperation({ summary: 'Create a new user (Admin only)' })
@ApiUnauthorizedResponse({ description: 'Not authenticated or invalid token' })
@ApiForbiddenResponse({ description: 'User does not have required role' })
create(@Body() createUserDto: CreateUserDto): Promise<User> {
  return this.usersService.create(createUserDto);
}
```

### Protecting a Route (Multiple Roles)

```typescript
@Get()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MODERATOR)
@ApiBearerAuth()
@ApiOperation({ summary: 'Get all active users (Admin/Moderator only)' })
findAll(@Query('orgId') orgId?: string): Promise<User[]> {
  return this.usersService.findAll(orgId);
}
```

### Authentication Only (No Role Check)

```typescript
@Get(':id')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiOperation({ summary: 'Get user by ID' })
findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
  return this.usersService.findOne(id);
}
```

## HTTP Status Codes

| Status Code | Meaning | When Returned |
|-------------|---------|---------------|
| 401 Unauthorized | Authentication required | Missing/invalid JWT token |
| 403 Forbidden | Access denied (role) | Valid token but insufficient role |
| 403 Forbidden | Access denied (org) | Valid token/role but wrong organization |
| 200/201 | Success | Valid token with correct role and org |

## Test Credentials

```
Acme Corporation (orgId: 11111111-1111-4111-a111-111111111111)
  Admin:     admin@acme.com / Admin123!
  Moderator: john@acme.com / Moderator123!
  User:      jane@acme.com / User123!

TechStart Inc (orgId: 22222222-2222-4222-a222-222222222222)
  Admin:     admin@techstart.com / Admin123!

Global Events Ltd (orgId: 33333333-3333-4333-a333-333333333333)
  Admin:     manager@globalevents.com / Admin123!
```

## Testing with curl

### 1. Login as Admin
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"Admin123!","orgId":"11111111-1111-4111-a111-111111111111"}'
```

### 2. Test 401 (No Token)
```bash
curl http://localhost:3000/users
# Returns 401 Unauthorized
```

### 3. Test 403 (Insufficient Role)
```bash
# Login as regular user first, get token
curl http://localhost:3000/users \
  -H "Authorization: Bearer <user_token>"
# Returns 403 Forbidden
```

### 4. Test Success (Admin)
```bash
curl http://localhost:3000/users \
  -H "Authorization: Bearer <admin_token>"
# Returns 200 with user list
```

### 4. Test Cross-Org Attack (Should Fail)
```bash
# Login as Acme admin, try to delete TechStart org
curl -X DELETE http://localhost:3000/orgs/22222222-2222-4222-a222-222222222222 \
  -H "Authorization: Bearer <acme_admin_token>"
# Returns 403 Forbidden: You can only delete your own organization
```

### 5. Test Own Org Delete (Should Succeed)
```bash
# Login as Acme admin, delete own org
curl -X DELETE http://localhost:3000/orgs/11111111-1111-4111-a111-111111111111 \
  -H "Authorization: Bearer <acme_admin_token>"
# Returns 200 OK
```

## E2E Tests

Comprehensive e2e tests were added in `test/rbac.e2e-spec.ts`:

```bash
# Run RBAC tests only
npm run test:e2e -- --testPathPatterns=rbac

# Test Results:
# ✓ 401 Unauthorized tests (7 tests)
# ✓ 403 Forbidden tests (9 tests)
# ✓ Success tests (10 tests)
# ✓ Role hierarchy tests (2 tests)
# ✓ Cookie authentication tests (2 tests)
# Total: 30 tests passed
```

## Key Files Changed

| File | Changes |
|------|---------|
| `src/modules/users/entities/user.entity.ts` | Updated UserRole enum values |
| `src/modules/auth/decorators/roles.decorator.ts` | New - @Roles decorator |
| `src/modules/auth/guards/roles.guard.ts` | New - RolesGuard implementation |
| `src/modules/auth/decorators/index.ts` | Export roles decorator |
| `src/modules/auth/guards/index.ts` | Export roles guard |
| `src/modules/users/controllers/users.controller.ts` | Added RBAC to all routes |
| `src/modules/orgs/controllers/orgs.controller.ts` | Added RBAC to all routes |
| `src/modules/users/dto/create-user.dto.ts` | Updated role validation message |
| `src/modules/auth/dto/signup.dto.ts` | Updated role validation message |
| `src/database/seed.ts` | Updated seed data with new roles |
| `src/database/reset.ts` | Added enum type cleanup |
| `test/rbac.e2e-spec.ts` | New - Comprehensive RBAC e2e tests |

## Definition of Done ✅

- [x] Role checks enforced reliably
- [x] 401 returned for missing/invalid token
- [x] 403 returned for forbidden (insufficient role)
- [x] 403 returned for cross-org access attempts
- [x] Tests cover both 401 and 403 cases
- [x] Sample routes protected for admin and moderator
- [x] Multi-tenant isolation enforced (admins can only modify own org)
- [x] Swagger documentation updated with auth requirements

## Next Steps (Day 7)

Consider implementing:
- Role-based field visibility (hide sensitive data from non-admins)
- ~~Organization-scoped roles (admin of specific org only)~~ ✅ Done
- Permission-based access (more granular than roles)
- Audit logging for sensitive operations
- Cross-org user management restrictions
