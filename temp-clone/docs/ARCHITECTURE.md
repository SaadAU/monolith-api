# Modular Monolith Architecture

## Overview

This document describes the modular monolith architecture of the EventBoard API. A modular monolith is a single deployable application that is internally structured into well-defined, loosely-coupled modules with clear boundaries.

## Why Modular Monolith?

### Benefits
- **Simplicity**: Single deployment unit, easier to develop and debug
- **Performance**: In-process communication is faster than network calls
- **Transactions**: ACID transactions can span multiple modules
- **Refactoring**: Easy to refactor and reorganize code
- **Migration Path**: Can extract modules into microservices later if needed

### vs. Microservices
- No network overhead for inter-module communication
- No distributed transaction complexity
- Simpler deployment and operations
- Easier to maintain consistency

### vs. Traditional Monolith
- Clear module boundaries prevent coupling
- Each module has a well-defined public API
- Modules communicate through events for decoupling
- Easier to understand and maintain

## Architecture Principles

### 1. Module Boundaries
Each module:
- Has a **single responsibility** (bounded context)
- Owns its **data** (entities, repositories)
- Exposes a **small, well-defined public API** (services, DTOs, events)
- **Hides implementation details** (controllers, internal services)

### 2. Communication Patterns

#### A. Direct Service Calls (Synchronous)
```
Module A → ModuleB.Service.method()
```
- Used when: Immediate response needed, strong coupling acceptable
- Example: AuthService called by guards, EventsService for CRUD

#### B. Domain Events (Asynchronous, In-Process)
```
Module A emits DomainEvent → Event Bus → Module B listens
```
- Used when: Decoupling needed, eventual consistency acceptable
- Example: ModerationService emits EventApprovedEvent → NotificationService listens
- Benefits: Loose coupling, easy to add new listeners

### 3. Dependency Rules
- **NO circular dependencies** between modules
- **One-way dependencies** only (e.g., Moderation → Events, NOT Events → Moderation)
- **Shared kernel** in `/common` (guards, decorators, events infrastructure)

## Module Structure

```
src/
├── common/                    # Shared kernel (cross-cutting concerns)
│   ├── decorators/           # @CurrentUser, @Ownership
│   ├── filters/              # Exception filters
│   ├── guards/               # Ownership guard, etc.
│   ├── interceptors/         # Logging, timing, response envelope
│   ├── middleware/           # Correlation ID
│   ├── pipes/                # Validation pipes
│   └── events/               # Domain event infrastructure ⭐
│       ├── domain-event.interface.ts
│       ├── domain-event-emitter.ts
│       └── events.module.ts  (Global)
│
├── modules/
│   ├── auth/                 # Authentication & Authorization
│   ├── orgs/                 # Organizations (Multi-tenancy)
│   ├── users/                # User management
│   ├── events/               # Event CRUD
│   └── moderation/           # Event approval workflow ⭐
│
└── app.module.ts             # Root module
```

## Module Catalog

### 1. Auth Module
**Responsibility**: Authentication and authorization

**Public API**:
- `AuthService`: Login, signup, token validation
- `JwtAuthGuard`: Protect routes requiring authentication
- `RolesGuard`: Protect routes requiring specific roles
- `@CurrentUser()`: Decorator to inject authenticated user
- `@Roles()`: Decorator to specify required roles

**Dependencies**:
- Users Module (UsersService)
- Orgs Module (Org entity)

**Data Owned**: None (uses User/Org entities)

---

### 2. Organizations Module
**Responsibility**: Organization management (multi-tenancy)

**Public API**:
- `OrgsService`: CRUD operations for organizations
- `Org` entity: Organization data type

**Dependencies**: None

**Data Owned**: `orgs` table

---

### 3. Users Module
**Responsibility**: User management and profiles

**Public API**:
- `UsersService`: CRUD operations for users
- `User` entity: User data type
- `UserRole` enum: ADMIN, MODERATOR, USER

**Dependencies**:
- Orgs Module (Org entity reference)

**Data Owned**: `users` table

---

### 4. Events Module
**Responsibility**: Event lifecycle management (CRUD)

**Public API**:
- `EventsService`: Create, read, update, delete events
- `Event` entity: Event data type
- `EventStatus` enum: DRAFT, SUBMITTED, APPROVED, REJECTED, etc.

**Dependencies**:
- Users Module (User entity reference for createdBy)

**Data Owned**: `events` table

---

### 5. Moderation Module ⭐
**Responsibility**: Event approval workflow and state transitions

**Public API**:
- `ModerationService`: Submit, approve, reject, revert events
- **Domain Events**: (for decoupling)
  - `EventSubmittedEvent`
  - `EventApprovedEvent`
  - `EventRejectedEvent`
  - `EventRevertedToDraftEvent`

**Dependencies**:
- Events Module (Event entity, EventsService)
- Users Module (User entity)
- Common Events Module (DomainEventEmitter)

**Data Owned**: None (modifies Event status)

**State Machine**:
```
  DRAFT ──────► SUBMITTED ──────► APPROVED
    ▲               │                 │
    │               ▼                 ▼
    └────────── REJECTED        CANCELLED/COMPLETED
```

---

## Domain Events Architecture

### Why Domain Events?

Domain events enable **loose coupling** between modules. Instead of Module A calling Module B directly, Module A emits an event that Module B listens to.

**Benefits**:
- **Decoupling**: Modules don't need to know about each other
- **Extensibility**: Easy to add new listeners without changing emitters
- **Testability**: Easy to test event emission and handling separately
- **Single Responsibility**: Each module focuses on its own domain

### Event Flow Example

```
┌─────────────────────────────────────────────────────────────────┐
│                    Moderation Workflow                          │
│                                                                 │
│  1. ModerationService.approve(eventId)                         │
│     ├─ Update Event status to APPROVED                         │
│     └─ Emit EventApprovedEvent                                 │
│                                                                 │
│  2. Event Bus (in-process)                                     │
│     ├─ EventEmitter2 broadcasts event                          │
│     └─ All registered listeners receive event                  │
│                                                                 │
│  3. Event Listeners (in any module)                            │
│     ├─ ModerationEventListener: Log approval                   │
│     ├─ NotificationService: Email event owner (future)         │
│     ├─ AnalyticsService: Track metrics (future)                │
│     └─ SearchService: Update search index (future)             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Event Naming Convention

Events are named in **past tense** (something that happened):
- `EventSubmittedEvent` (not `SubmitEventEvent`)
- `EventApprovedEvent` (not `ApproveEventEvent`)

Event names follow the pattern: `<Entity><Action>Event`

### Event Structure

All domain events implement `IDomainEvent`:

```typescript
interface IDomainEvent {
  eventId: string;        // Unique event occurrence ID
  occurredAt: Date;       // When it happened
  eventName: string;      // Event type (e.g., 'event.approved')
  aggregateId: string;    // Entity ID (e.g., Event ID)
}
```

### Implementing Events

#### 1. Define the Event
```typescript
// src/modules/moderation/events/moderation.events.ts
export class EventApprovedEvent extends BaseEventDomainEvent {
  readonly eventName = 'event.approved';

  constructor(
    aggregateId: string,    // Event ID
    userId: string,         // Event owner ID
    orgId: string,          // Org ID
    public readonly moderatorId: string,
    public readonly eventTitle: string,
  ) {
    super(aggregateId, userId, orgId);
  }
}
```

#### 2. Emit the Event
```typescript
// src/modules/moderation/services/moderation.service.ts
this.domainEventEmitter.emit(
  new EventApprovedEvent(eventId, userId, orgId, moderatorId, title)
);
```

#### 3. Listen to the Event
```typescript
// Any module can listen
import { OnEvent } from '@nestjs/event-emitter';

@Injectable()
export class MyEventListener {
  @OnEvent('event.approved')
  handleEventApproved(event: EventApprovedEvent) {
    // React to the event
    console.log(`Event ${event.aggregateId} approved!`);
  }
}
```

## Circular Dependency Prevention

### Problem
Circular dependencies occur when Module A imports Module B, and Module B imports Module A:
```
User Entity ─imports─> Org Entity
Org Entity  ─imports─> User Entity  ❌ CIRCULAR!
```

### Solution: Lazy Loading
Use TypeScript's dynamic imports for entity relationships:

```typescript
// Before (circular)
import { Org } from '../../orgs/entities/org.entity';
@ManyToOne(() => Org, ...)

// After (no circular)
@ManyToOne(() => import('../../orgs/entities/org.entity').then(m => m.Org), ...)
```

This breaks the compile-time dependency while preserving runtime behavior.

### Verification
Run the circular dependency checker:
```bash
npx madge --circular --extensions ts ./src
```

Should output: **✓ No circular dependencies found!**

## Module API Guidelines

### DO ✅
- Export only what other modules need (services, entities, enums)
- Document module boundaries in `index.ts`
- Use domain events for decoupling
- Keep DTOs internal to the module (unless needed for API)
- Use services as the public API, not repositories

### DON'T ❌
- Export controllers (they're internal HTTP endpoints)
- Export repositories directly (use services instead)
- Create circular dependencies
- Reach into another module's internals
- Skip the public API (always go through `index.ts`)

## Testing Strategy

### Unit Tests
- Test each service in isolation
- Mock dependencies (repositories, other services)
- Example: `moderation.service.spec.ts`

### Integration Tests
- Test module interactions
- Use real database (test container)
- Example: Module A emits event → Module B handles it

### E2E Tests
- Test complete user journeys
- Example: `critical-flow.e2e-spec.ts` (signup → create event → submit → approve)

## Future Enhancements

### Potential New Modules
- **Notifications Module**: Email/SMS notifications (listens to moderation events)
- **Analytics Module**: Track metrics and generate reports
- **Search Module**: Full-text search (listens to event changes)
- **Audit Module**: Track all changes for compliance

### Migration to Microservices (if needed)
If a module grows too large or has different scaling needs:
1. Extract module into its own service
2. Replace in-process events with message queue (RabbitMQ, Kafka)
3. Replace direct service calls with HTTP/gRPC
4. Split database (if needed)

The modular structure makes this migration path straightforward.

## Conclusion

The modular monolith architecture provides:
- ✅ Clear module boundaries
- ✅ Loose coupling through domain events
- ✅ No circular dependencies
- ✅ Small, well-defined public APIs
- ✅ Easy to understand and maintain
- ✅ Migration path to microservices if needed

This architecture balances simplicity with maintainability, making it ideal for growing applications.
