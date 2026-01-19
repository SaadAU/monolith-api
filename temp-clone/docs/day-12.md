# Day 12: Modular Monolith Architecture Refactor

## Overview

Day 12 focuses on transforming the application into a well-structured modular monolith with clear module boundaries, no circular dependencies, and domain events for decoupling. This ensures the codebase is maintainable, testable, and can scale to larger teams.

## What Was Implemented

### 1. Domain Events Infrastructure

Created a complete domain events system for in-process, asynchronous communication between modules.

**Files Created:**
- [src/common/events/domain-event.interface.ts](../src/common/events/domain-event.interface.ts)
- [src/common/events/domain-event-emitter.ts](../src/common/events/domain-event-emitter.ts)
- [src/common/events/events.module.ts](../src/common/events/events.module.ts)
- [src/common/events/index.ts](../src/common/events/index.ts)

**Key Concepts:**
- `IDomainEvent`: Base interface for all domain events
- `DomainEventEmitter`: Type-safe wrapper around NestJS EventEmitter2
- `CommonEventsModule`: Global module providing event infrastructure

**Domain Event Structure:**
```typescript
interface IDomainEvent {
  eventId: string;        // Unique event occurrence ID
  occurredAt: Date;       // When it happened
  eventName: string;      // Event type (e.g., 'event.approved')
  aggregateId: string;    // Entity ID (e.g., Event ID)
}
```

### 2. Moderation Domain Events

Created specific domain events for the moderation workflow to demonstrate decoupling.

**Files Created:**
- [src/modules/moderation/events/moderation.events.ts](../src/modules/moderation/events/moderation.events.ts)
- [src/modules/moderation/events/index.ts](../src/modules/moderation/events/index.ts)
- [src/modules/moderation/listeners/moderation-event.listener.ts](../src/modules/moderation/listeners/moderation-event.listener.ts)
- [src/modules/moderation/listeners/index.ts](../src/modules/moderation/listeners/index.ts)

**Events Implemented:**
| Event | Trigger | Use Case |
|-------|---------|----------|
| `EventSubmittedEvent` | Event submitted for review | Notify moderators |
| `EventApprovedEvent` | Event approved | Notify owner, publish to calendar |
| `EventRejectedEvent` | Event rejected | Notify owner with reason |
| `EventRevertedToDraftEvent` | Event sent back to draft | Remove from public listings |

**Event Flow:**
```
ModerationService.approve(eventId)
  └─> Save Event with APPROVED status
  └─> Emit EventApprovedEvent
        └─> ModerationEventListener logs the event
        └─> Future: NotificationService sends email
        └─> Future: SearchService updates index
```

**Benefits:**
- ✅ Loose coupling: Modules don't depend on each other
- ✅ Extensibility: Easy to add new listeners
- ✅ Testability: Can test event emission separately
- ✅ Auditability: All events are logged

### 3. Fixed Circular Dependencies

**Problem Found:**
```
User Entity ─imports─> Org Entity
Org Entity  ─imports─> User Entity  ❌ CIRCULAR!
```

**Solution:**
Removed the `@ManyToOne` and `@OneToMany` decorators between User and Org entities. Instead, we only keep the foreign key (`orgId`) and use services to load related entities when needed.

**Before:**
```typescript
// user.entity.ts
import { Org } from '../../orgs/entities/org.entity';
@ManyToOne(() => Org, org => org.users)
org!: Org;

// org.entity.ts
import { User } from '../../users/entities/user.entity';
@OneToMany(() => User, user => user.org)
users!: User[];
```

**After:**
```typescript
// user.entity.ts
@Column({ type: 'uuid' })
orgId!: string;
// Use OrgsService.findOne(orgId) to load the org

// org.entity.ts
// No users relation
// Use UsersService.findByOrg(orgId) to load users
```

**Verification:**
```bash
npx madge --circular --extensions ts ./src
✔ No circular dependency found!
```

**Why This Is Better:**
- ✅ Enforces module boundaries
- ✅ Prevents accidental coupling
- ✅ Forces explicit service calls
- ✅ Makes dependencies clear

### 4. Module Public APIs

Documented and enforced clear public APIs for each module through `index.ts` files.

**Files Updated:**
- [src/modules/auth/index.ts](../src/modules/auth/index.ts)
- [src/modules/orgs/index.ts](../src/modules/orgs/index.ts)
- [src/modules/users/index.ts](../src/modules/users/index.ts)
- [src/modules/events/index.ts](../src/modules/events/index.ts)
- [src/modules/moderation/index.ts](../src/modules/moderation/index.ts)

**Public API Pattern:**
```typescript
/**
 * Module Public API
 * 
 * Public Exports:
 * - Module, Service, Entities, DTOs
 * 
 * Internal (not exported):
 * - Controllers, Repositories
 * 
 * Module Boundaries:
 * - What this module owns
 * - How other modules should interact
 */

export { SomeModule } from './some.module';
export { SomeService } from './services/some.service';
// DO NOT export controllers or repositories
```

**Module Responsibility Matrix:**
| Module | Owns | Public API | Dependencies |
|--------|------|------------|--------------|
| **Auth** | Authentication/Authorization | AuthService, Guards, Decorators | Users, Orgs |
| **Orgs** | Organization data | OrgsService, Org entity | None |
| **Users** | User data | UsersService, User entity | Orgs (orgId only) |
| **Events** | Event CRUD | EventsService, Event entity | Users |
| **Moderation** | Event workflow | ModerationService, Domain Events | Events, Users |

### 5. Docker Containerization

Containerized the backend application for consistent development and deployment environments.

**Files:**
- [Dockerfile](../Dockerfile) - Multi-stage build for NestJS app
- [docker-compose.yml](../docker-compose.yml) - Orchestrates Postgres + API

**Docker Setup:**
```yaml
services:
  postgres:
    - PostgreSQL 16
    - Port: 5433 (host) → 5432 (container)
    - Credentials: admin/admin123
    - Persistent volume: postgres_data
  
  api:
    - NestJS application
    - Port: 3000
    - Hot-reload enabled (development mode)
    - Depends on postgres service
    - Shared network: app-network
```

**Commands:**
```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f api

# Stop all services
docker compose down

# Rebuild after code changes
docker compose up --build
```

**Benefits:**
- ✅ Consistent development environment across team
- ✅ Easy setup for new developers (single command)
- ✅ Postgres + API orchestrated together
- ✅ Hot-reload for fast development
- ✅ Production-ready containerization

### 6. Architecture Documentation

Created comprehensive architecture documentation explaining the modular monolith approach.

**File Created:**
- [docs/ARCHITECTURE.md](ARCHITECTURE.md)

**Sections:**
1. **Overview**: What is a modular monolith and why use it
2. **Architecture Principles**: Module boundaries, communication patterns, dependency rules
3. **Module Structure**: Directory layout
4. **Module Catalog**: Each module's responsibility and API
5. **Domain Events Architecture**: How events enable decoupling
6. **Circular Dependency Prevention**: Solutions and verification
7. **Module API Guidelines**: DOs and DON'Ts
8. **Testing Strategy**: Unit, integration, E2E
9. **Future Enhancements**: Potential new modules, migration path

**Key Diagrams Included:**
- Module structure tree
- Event flow diagram
- State machine diagram
- Communication patterns

## Architecture Summary

### Communication Patterns

#### 1. Direct Service Calls (Synchronous)
```typescript
// For immediate responses
const user = await this.usersService.findOne(userId);
```

#### 2. Domain Events (Asynchronous, In-Process)
```typescript
// For decoupling
this.domainEventEmitter.emit(
  new EventApprovedEvent(eventId, userId, orgId, moderatorId, title)
);
```

### Dependency Graph

```
┌─────────────────────────────────────────────────────────────────┐
│                      Dependency Flow                             │
│                                                                  │
│   Auth ──────────────────> Users ──────> Orgs                  │
│     │                        ▲                                   │
│     │                        │                                   │
│     └──────────> Events ─────┘                                  │
│                    ▲                                             │
│                    │                                             │
│                Moderation                                        │
│                    │                                             │
│                    ▼                                             │
│              Domain Events (decoupled)                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Points:**
- ✅ One-way dependencies (no cycles)
- ✅ Domain events break tight coupling
- ✅ Each module has clear responsibility

## Testing

### Verify No Circular Dependencies
```bash
npx madge --circular --extensions ts ./src
✔ No circular dependency found!
```

### Test Domain Events
```bash
# Run the app with Docker
docker compose up

# In logs, you should see:
# [ModerationEventListener] Event submitted for moderation: ...
# [ModerationEventListener] Event approved: ...
```

### Run Unit Tests
```bash
npm run test
# All 54 tests passing ✅
```

## Definition of Done ✅

| Requirement | Status |
|-------------|--------|
| No circular dependencies | ✅ Verified with madge |
| Domain events demonstrate decoupling | ✅ Moderation events implemented |
| Architecture doc explains boundaries and why | ✅ ARCHITECTURE.md created |
| Module boundaries enforced | ✅ Public APIs documented |
| **Docker containerization** | ✅ Dockerfile + docker-compose.yml |

## Files Changed/Created

### Created
| File | Purpose |
|------|---------|
| `src/common/events/domain-event.interface.ts` | Base domain event interface |
| `src/common/events/domain-event-emitter.ts` | Event emitter service |
| `src/common/events/events.module.ts` | Global events module |
| `src/common/events/index.ts` | Public API |
| `src/modules/moderation/events/moderation.events.ts` | Moderation domain events |
| `src/modules/moderation/events/index.ts` | Events public API |
| `src/modules/moderation/listeners/moderation-event.listener.ts` | Event listener example |
| `src/modules/moderation/listeners/index.ts` | Listeners public API |
| `docs/ARCHITECTURE.md` | Architecture documentation |

### Modified
| File | Change |
|------|--------|
| `src/modules/moderation/services/moderation.service.ts` | Added domain event emission |
| `src/modules/moderation/moderation.module.ts` | Registered event listener |
| `src/modules/moderation/services/moderation.service.spec.ts` | Added DomainEventEmitter mock |
| `src/modules/users/entities/user.entity.ts` | Removed circular dependency |
| `src/modules/orgs/entities/org.entity.ts` | Removed circular dependency |
| `src/app.module.ts` | Added CommonEventsModule |
| `src/modules/*/index.ts` | Added module boundary documentation |
| `Dockerfile` | Created for containerization |
| `docker-compose.yml` | Created for orchestration |

## Package Installed
```bash
npm install @nestjs/event-emitter
```

## Next Steps (Future Improvements)

1. **Add More Event Listeners**
   - NotificationService: Send emails on event approval/rejection
   - AnalyticsService: Track moderation metrics
   - SearchService: Update search index when events change

2. **Add Integration Tests**
   - Test event emission and handling end-to-end
   - Verify decoupling between modules

3. **Add More Domain Events**
   - UserCreatedEvent, UserDeletedEvent
   - OrgCreatedEvent, OrgDeactivatedEvent

4. **Consider Saga Pattern**
   - For complex workflows spanning multiple modules
   - Example: User signup → Create default org → Assign admin role

5. **Add Circuit Breaker**
   - Prevent cascading failures in event listeners
   - Retry failed event handlers

## Key Learnings

### Why Modular Monolith?
- **Start simple**: Easier than microservices
- **Stay organized**: Clear boundaries like microservices
- **Evolve later**: Can extract modules if needed

### Domain Events Benefits
- **Decoupling**: Modules don't know about each other
- **Extensibility**: Add new features without changing existing code
- **Testability**: Test event emission and handling separately
- **Auditability**: All important actions are logged

### Circular Dependencies
- **Prevention is key**: Design modules to avoid cycles
- **Foreign keys over relations**: Use orgId instead of @ManyToOne
- **Verify regularly**: Use madge in CI/CD

## Conclusion

The modular monolith architecture provides the best of both worlds:
- **Simplicity**: Single deployment, no distributed system complexity
- **Maintainability**: Clear boundaries, small public APIs
- **Scalability**: Can extract modules later if needed

This architecture will support the application's growth while keeping the codebase clean and maintainable.
