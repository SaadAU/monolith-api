# Day 7: Events CRUD (Org-Scoped + Ownership)

## Overview

Day 7 implements a complete Events management module with **multi-tenancy** (org scoping) and **ownership controls**. Users can create, read, update, and delete events, but with strict isolation between organizations and permission checks ensuring only event creators can modify their events.

## What Was Implemented

### 1. Event Entity

Created the `Event` database entity with status lifecycle management:

```typescript
// src/modules/events/entities/event.entity.ts
export enum EventStatus {
  DRAFT = 'draft',        // Event is being created/edited, not visible
  PUBLISHED = 'published', // Event is live and visible
  CANCELLED = 'cancelled', // Event was cancelled
  COMPLETED = 'completed', // Event has finished
}

@Entity('events')
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ length: 255, nullable: true })
  location?: string;

  @Column({ type: 'timestamp' })
  startDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  endDate?: Date;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status!: EventStatus;

  @Column({ type: 'int', nullable: true })
  maxAttendees?: number;

  @Column({ type: 'boolean', default: false })
  isVirtual!: boolean;

  @Column({ length: 500, nullable: true })
  virtualUrl?: string;

  // Organization relationship (for multi-tenancy)
  @Column({ type: 'uuid' })
  orgId!: string;

  @ManyToOne(() => Org, { onDelete: 'CASCADE' })
  org!: Org;

  // Owner relationship (for ownership checks)
  @Column({ type: 'uuid' })
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  createdBy!: User;
}
```

### 2. DTOs with Validation

#### Create Event DTO
```typescript
// src/modules/events/dto/create-event.dto.ts
export class CreateEventDto {
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @MaxLength(5000)
  description?: string;

  @IsNotEmpty()
  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @IsOptional()
  @IsBoolean()
  isVirtual?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.isVirtual === true)
  @IsUrl()
  virtualUrl?: string;
}
```

#### Response DTO (Prevents Data Leaks)
```typescript
// src/modules/events/dto/event-response.dto.ts
@Exclude()
export class EventResponseDto {
  @Expose() id!: string;
  @Expose() title!: string;
  @Expose() description?: string;
  @Expose() location?: string;
  @Expose() startDate!: Date;
  @Expose() endDate?: Date;
  @Expose() status!: EventStatus;
  @Expose() orgId!: string;
  @Expose() createdById!: string;
  
  @Expose()
  @Type(() => EventCreatorDto)
  createdBy?: EventCreatorDto; // Only exposes id and name
}
```

### 3. Events Service with Org Scoping

All queries are automatically scoped to the user's organization:

```typescript
// src/modules/events/services/events.service.ts
@Injectable()
export class EventsService {
  // Create - auto-assigns orgId and createdById
  async create(dto: CreateEventDto, userId: string, orgId: string): Promise<EventResponseDto> {
    const event = this.eventsRepository.create({
      ...dto,
      orgId,           // Automatically set from user's org
      createdById: userId,  // Automatically set as owner
    });
    return this.toResponseDto(await this.eventsRepository.save(event));
  }

  // Find all - org-scoped
  async findAll(orgId: string, queryDto: QueryEventsDto): Promise<EventListResponseDto> {
    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .where('event.orgId = :orgId', { orgId }); // ORG SCOPING!
    // ... filtering, pagination, sorting
  }

  // Find one - org-scoped
  async findOne(id: string, orgId: string): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id, orgId }, // ORG SCOPING!
    });
    if (!event) throw new NotFoundException();
    return this.toResponseDto(event);
  }

  // Update - ownership required
  async update(id: string, dto: UpdateEventDto, userId: string, orgId: string) {
    const event = await this.findOneEntity(id, orgId);
    
    if (event.createdById !== userId) {
      throw new ForbiddenException('You can only edit events you created');
    }
    // ... apply updates
  }

  // Delete - ownership required
  async remove(id: string, userId: string, orgId: string): Promise<void> {
    const event = await this.findOneEntity(id, orgId);
    
    if (event.createdById !== userId) {
      throw new ForbiddenException('You can only delete events you created');
    }
    await this.eventsRepository.remove(event);
  }
}
```

### 4. Events Controller

```typescript
// src/modules/events/controllers/events.controller.ts
@Controller('events')
@ApiTags('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class EventsController {
  @Post()
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: User,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(createEventDto, user.id, user.orgId);
  }

  @Get()
  async findAll(
    @Query() queryDto: QueryEventsDto,
    @CurrentUser() user: User,
  ): Promise<EventListResponseDto> {
    return this.eventsService.findAll(user.orgId, queryDto);
  }

  @Get('my-events')
  async findMyEvents(@CurrentUser() user: User) {
    return this.eventsService.findByCreator(user.id, user.orgId, queryDto);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.findOne(id, user.orgId);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: User,
  ) {
    return this.eventsService.update(id, updateEventDto, user.id, user.orgId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: User) {
    return this.eventsService.remove(id, user.id, user.orgId);
  }
}
```

### 5. Reusable Ownership Guard (Bonus)

Created a generic ownership decorator and guard for future use:

```typescript
// src/common/decorators/ownership.decorator.ts
export interface OwnershipMetadata {
  serviceName: string;  // e.g., 'EventsService'
  methodName: string;   // e.g., 'isOwner'
  idParam: string;      // e.g., 'id'
}

export const RequireOwnership = (metadata: OwnershipMetadata) =>
  SetMetadata(OWNERSHIP_KEY, metadata);

// Usage:
// @UseGuards(JwtAuthGuard, OwnershipGuard)
// @RequireOwnership({ serviceName: 'EventsService', methodName: 'isOwner', idParam: 'id' })
```

## API Endpoints

| Method | Endpoint | Description | Auth | Ownership |
|--------|----------|-------------|------|-----------|
| `POST` | `/events` | Create event | ✅ | Auto-assigned |
| `GET` | `/events` | List org events | ✅ | - |
| `GET` | `/events/my-events` | List user's events | ✅ | - |
| `GET` | `/events/:id` | Get single event | ✅ | - |
| `PATCH` | `/events/:id` | Update event | ✅ | **Owner only** |
| `DELETE` | `/events/:id` | Delete event | ✅ | **Owner only** |

## Query Parameters (GET /events)

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `status` | enum | Filter by status (draft, published, etc.) | - |
| `search` | string | Search by title | - |
| `page` | number | Page number | 1 |
| `limit` | number | Items per page (max 100) | 10 |
| `sortBy` | string | Sort field (startDate, createdAt, title) | startDate |
| `sortOrder` | ASC/DESC | Sort direction | ASC |

## Security Model

### Org Scoping (Multi-tenancy)

```
Organization A (orgId: aaaa-...)        Organization B (orgId: bbbb-...)
├── Alice (userA1)                      ├── Charlie (userB1)
├── Bob (userA2)                        └── Event: "Sales Meeting"
├── Event: "Tech Talk" (by Alice)
└── Event: "Hackathon" (by Bob)

Scenario: Charlie tries to GET /events/[tech-talk-id]
Result: 404 Not Found (event not in Charlie's org)
```

### Ownership Control

```
Scenario: Bob tries to PATCH /events/[tech-talk-id] (owned by Alice)
Result: 403 Forbidden - "You can only edit events you created"

Scenario: Alice tries to PATCH /events/[tech-talk-id]
Result: 200 OK ✅
```

## HTTP Status Codes

| Status Code | Meaning | When Returned |
|-------------|---------|---------------|
| 200 | Success | GET, PATCH successful |
| 201 | Created | POST successful |
| 204 | No Content | DELETE successful |
| 400 | Bad Request | Validation error (dates, required fields) |
| 401 | Unauthorized | Missing/invalid JWT token |
| 403 | Forbidden | Not the event owner |
| 404 | Not Found | Event doesn't exist or not in user's org |

## Testing with curl

### 1. Login
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@acme.com","password":"Admin123!","orgId":"11111111-1111-4111-a111-111111111111"}' \
  -c cookies.txt
```

### 2. Create Event
```bash
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Annual Conference 2026",
    "description": "Our yearly tech conference",
    "location": "Convention Center",
    "startDate": "2026-06-15T09:00:00Z",
    "endDate": "2026-06-15T18:00:00Z",
    "status": "draft",
    "maxAttendees": 500
  }'
```

### 3. List Events (with filters)
```bash
curl "http://localhost:3000/events?status=draft&page=1&limit=10&sortBy=startDate&sortOrder=ASC" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 4. Get Single Event
```bash
curl http://localhost:3000/events/EVENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 5. Update Event (Owner Only)
```bash
curl -X PATCH http://localhost:3000/events/EVENT_ID \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"title": "Updated Conference Title", "status": "published"}'
```

### 6. Delete Event (Owner Only)
```bash
curl -X DELETE http://localhost:3000/events/EVENT_ID \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## E2E Tests

23 comprehensive tests covering:

- ✅ Authentication requirements (401 without token)
- ✅ Event creation with validation
- ✅ Virtual events requiring URL
- ✅ Date validation (end > start)
- ✅ Org scoping (users only see their org's events)
- ✅ Ownership (only creators can edit/delete)
- ✅ 403 for non-owners attempting edits
- ✅ 404 for cross-org access attempts
- ✅ Response DTO doesn't leak sensitive fields
- ✅ Pagination and filtering

Run tests:
```bash
npm run test:e2e -- --testPathPatterns=events.e2e-spec.ts
```

## Files Created

```
src/modules/events/
├── entities/
│   └── event.entity.ts          # Database entity
├── dto/
│   ├── create-event.dto.ts      # Create validation
│   ├── update-event.dto.ts      # Update validation
│   ├── event-response.dto.ts    # Response mapping
│   ├── query-events.dto.ts      # Query parameters
│   └── index.ts                 # Barrel export
├── services/
│   └── events.service.ts        # Business logic
├── controllers/
│   └── events.controller.ts     # REST API
├── events.module.ts             # Module definition
└── index.ts                     # Barrel export

src/common/
├── decorators/
│   ├── ownership.decorator.ts   # @RequireOwnership
│   └── index.ts
└── guards/
    ├── ownership.guard.ts       # Generic ownership guard
    └── index.ts

test/
└── events.e2e-spec.ts           # 23 e2e tests
```

## Key Concepts Demonstrated

| Concept | Implementation |
|---------|----------------|
| **Multi-tenancy** | All queries include `WHERE orgId = :userOrgId` |
| **Ownership** | Update/Delete checks `createdById === userId` |
| **DTO Mapping** | `plainToInstance()` with `@Exclude()/@Expose()` |
| **Validation** | class-validator decorators on DTOs |
| **Pagination** | Skip/take with total count |
| **Filtering** | Query builder with optional conditions |
