# Day 8: Moderation Workflow (State Transitions)

## Overview

Day 8 implements a complete **moderation workflow** for events with state machine-based transitions. Events must go through a submission and approval process before becoming publicly visible. This enables content moderation by designated moderators and admins while giving event creators control over their submissions.

## What Was Implemented

### 1. Extended Event Status Enum

Extended the `EventStatus` enum to support the moderation workflow:

```typescript
// src/modules/events/entities/event.entity.ts
export enum EventStatus {
  DRAFT = 'draft',           // Event is being created/edited
  SUBMITTED = 'submitted',   // Event submitted for review
  APPROVED = 'approved',     // Event approved by moderator
  REJECTED = 'rejected',     // Event rejected with reason
  CANCELLED = 'cancelled',   // Event was cancelled
  COMPLETED = 'completed',   // Event has finished
}
```

### 2. Audit Fields on Event Entity

Added moderation audit fields to track who and when moderation actions occurred:

```typescript
// Added to Event entity
@Column({ type: 'text', nullable: true })
rejectionReason?: string;

@Column({ type: 'timestamp', nullable: true })
submittedAt?: Date;

@Column({ type: 'timestamp', nullable: true })
approvedAt?: Date;

@Column({ type: 'timestamp', nullable: true })
rejectedAt?: Date;

@Column({ type: 'uuid', nullable: true })
moderatedById?: string;

@ManyToOne(() => User, { nullable: true })
@JoinColumn({ name: 'moderatedById' })
moderatedBy?: User;
```

### 3. State Machine Transitions

Implemented allowed state transitions with clear business rules:

```typescript
// src/modules/moderation/services/moderation.service.ts
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.SUBMITTED],
  [EventStatus.SUBMITTED]: [EventStatus.APPROVED, EventStatus.REJECTED],
  [EventStatus.APPROVED]: [EventStatus.CANCELLED, EventStatus.COMPLETED],
  [EventStatus.REJECTED]: [EventStatus.DRAFT],
  [EventStatus.CANCELLED]: [],
  [EventStatus.COMPLETED]: [],
};
```

**State Transition Diagram:**
```
┌─────────┐    submit    ┌───────────┐
│  DRAFT  │─────────────▶│ SUBMITTED │
└─────────┘              └───────────┘
     ▲                         │
     │                         │
     │ revert            ┌─────┴─────┐
     │                   │           │
     │              approve      reject
     │                   │           │
     │                   ▼           ▼
     │            ┌──────────┐ ┌──────────┐
     └────────────│ APPROVED │ │ REJECTED │
                  └──────────┘ └──────────┘
                       │
              ┌────────┴────────┐
              │                 │
           cancel           complete
              │                 │
              ▼                 ▼
        ┌───────────┐   ┌───────────┐
        │ CANCELLED │   │ COMPLETED │
        └───────────┘   └───────────┘
```

### 4. Moderation Module Structure

```
src/modules/moderation/
├── moderation.module.ts
├── controllers/
│   └── moderation.controller.ts
├── services/
│   └── moderation.service.ts
├── dto/
│   ├── index.ts
│   ├── reject-event.dto.ts
│   └── moderation-response.dto.ts
└── index.ts
```

### 5. Moderation Service

The service implements all moderation business logic:

```typescript
// src/modules/moderation/services/moderation.service.ts
@Injectable()
export class ModerationService {
  // Submit event for review (owner only)
  async submit(eventId: string, userId: string): Promise<ModerationResponseDto>

  // Approve event (moderator/admin only)
  async approve(eventId: string, moderatorId: string): Promise<ModerationResponseDto>

  // Reject event with reason (moderator/admin only)
  async reject(eventId: string, moderatorId: string, reason: string): Promise<ModerationResponseDto>

  // Revert rejected event to draft (owner only)
  async revertToDraft(eventId: string, userId: string): Promise<ModerationResponseDto>

  // Get all pending events (moderator/admin only)
  async getPendingEvents(page: number, limit: number): Promise<PaginatedResponse<Event>>

  // Get event moderation status
  async getEventStatus(eventId: string): Promise<Event>
}
```

### 6. Moderation Controller

REST endpoints for the moderation workflow:

```typescript
// src/modules/moderation/controllers/moderation.controller.ts
@Controller('moderation')
@UseGuards(JwtAuthGuard)
@ApiTags('Moderation')
export class ModerationController {
  // POST /moderation/events/:id/submit
  @Post('events/:id/submit')
  async submitEvent(@Param('id') id: string, @CurrentUser() user: User)

  // POST /moderation/events/:id/approve (Moderator/Admin only)
  @Post('events/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  async approveEvent(@Param('id') id: string, @CurrentUser() user: User)

  // POST /moderation/events/:id/reject (Moderator/Admin only)
  @Post('events/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  async rejectEvent(@Param('id') id: string, @Body() dto: RejectEventDto, @CurrentUser() user: User)

  // POST /moderation/events/:id/revert-to-draft
  @Post('events/:id/revert-to-draft')
  async revertToDraft(@Param('id') id: string, @CurrentUser() user: User)

  // GET /moderation/events/pending (Moderator/Admin only)
  @Get('events/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  async getPendingEvents(@Query('page') page: number, @Query('limit') limit: number)

  // GET /moderation/events/:id/status
  @Get('events/:id/status')
  async getEventStatus(@Param('id') id: string)
}
```

### 7. DTOs

#### Reject Event DTO
```typescript
// src/modules/moderation/dto/reject-event.dto.ts
export class RejectEventDto {
  @ApiProperty({
    description: 'Reason for rejecting the event',
    example: 'Event description does not meet community guidelines.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @IsString({ message: 'reason must be a string' })
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(1000, { message: 'Rejection reason must not exceed 1000 characters' })
  reason!: string;
}
```

#### Moderation Response DTO
```typescript
// src/modules/moderation/dto/moderation-response.dto.ts
export class ModerationResponseDto {
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @ApiProperty({ description: 'Event title' })
  title!: string;

  @ApiProperty({ enum: EventStatus, description: 'Current event status' })
  status!: EventStatus;

  @ApiProperty({ enum: EventStatus, description: 'Previous event status' })
  previousStatus!: EventStatus;

  @ApiProperty({ description: 'Action performed' })
  action!: 'submit' | 'approve' | 'reject' | 'revert-to-draft';

  @ApiProperty({ description: 'Human-readable message' })
  message!: string;

  @ApiPropertyOptional({ description: 'Rejection reason (if rejected)' })
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'When event was submitted' })
  submittedAt?: Date;

  @ApiPropertyOptional({ description: 'When event was approved' })
  approvedAt?: Date;

  @ApiPropertyOptional({ description: 'When event was rejected' })
  rejectedAt?: Date;

  @ApiPropertyOptional({ description: 'User who moderated the event' })
  moderatedBy?: { id: string; name: string; email: string };
}
```

## API Endpoints

### Submit Event for Review
```http
POST /moderation/events/:id/submit
Authorization: Bearer <token>

Response 200:
{
  "id": "event-uuid",
  "title": "Tech Conference 2026",
  "status": "submitted",
  "previousStatus": "draft",
  "action": "submit",
  "message": "Event has been submitted for review",
  "submittedAt": "2026-01-03T10:00:00.000Z"
}
```

### Approve Event (Moderator/Admin)
```http
POST /moderation/events/:id/approve
Authorization: Bearer <moderator-token>

Response 200:
{
  "id": "event-uuid",
  "title": "Tech Conference 2026",
  "status": "approved",
  "previousStatus": "submitted",
  "action": "approve",
  "message": "Event has been approved and is now visible",
  "approvedAt": "2026-01-03T12:00:00.000Z",
  "moderatedBy": {
    "id": "moderator-uuid",
    "name": "John Moderator",
    "email": "john@acme.com"
  }
}
```

### Reject Event (Moderator/Admin)
```http
POST /moderation/events/:id/reject
Authorization: Bearer <moderator-token>
Content-Type: application/json

{
  "reason": "Event description does not meet community guidelines. Please add more details."
}

Response 200:
{
  "id": "event-uuid",
  "title": "Tech Conference 2026",
  "status": "rejected",
  "previousStatus": "submitted",
  "action": "reject",
  "message": "Event has been rejected",
  "rejectionReason": "Event description does not meet community guidelines. Please add more details.",
  "rejectedAt": "2026-01-03T12:00:00.000Z",
  "moderatedBy": {
    "id": "moderator-uuid",
    "name": "John Moderator",
    "email": "john@acme.com"
  }
}
```

### Revert to Draft
```http
POST /moderation/events/:id/revert-to-draft
Authorization: Bearer <token>

Response 200:
{
  "id": "event-uuid",
  "title": "Tech Conference 2026",
  "status": "draft",
  "previousStatus": "rejected",
  "action": "revert-to-draft",
  "message": "Event has been reverted to draft for editing"
}
```

### Get Pending Events (Moderator/Admin)
```http
GET /moderation/events/pending?page=1&limit=10
Authorization: Bearer <moderator-token>

Response 200:
{
  "data": [
    {
      "id": "event-uuid",
      "title": "Tech Conference 2026",
      "status": "submitted",
      "submittedAt": "2026-01-03T10:00:00.000Z",
      "createdBy": { "id": "...", "name": "Jane User" }
    }
  ],
  "total": 5,
  "page": 1,
  "limit": 10,
  "totalPages": 1
}
```

### Get Event Status
```http
GET /moderation/events/:id/status
Authorization: Bearer <token>

Response 200:
{
  "id": "event-uuid",
  "title": "Tech Conference 2026",
  "status": "rejected",
  "rejectionReason": "Please add more details...",
  "submittedAt": "2026-01-03T10:00:00.000Z",
  "rejectedAt": "2026-01-03T12:00:00.000Z",
  "moderatedBy": { "id": "...", "name": "John Moderator" }
}
```

## Error Handling

### Invalid State Transitions

**400 Bad Request** - When trying an invalid transition:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Event must be in DRAFT status to submit. Current status: approved"
}
```

**409 Conflict** - When action already performed:
```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "Event is already submitted for review"
}
```

### Authorization Errors

**403 Forbidden** - Non-owner trying to submit:
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "You can only submit events you created"
}
```

**403 Forbidden** - Regular user trying to approve/reject:
```json
{
  "statusCode": 403,
  "error": "Forbidden",
  "message": "Only moderators and admins can approve events"
}
```

### Validation Errors

**400 Bad Request** - Rejection reason too short:
```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": ["Rejection reason must be at least 10 characters"]
}
```

## Business Rules

1. **Submit**: Only the event owner can submit their event for review
2. **Approve/Reject**: Only users with `moderator` or `admin` role can approve or reject
3. **Revert to Draft**: Only the event owner can revert a rejected event back to draft
4. **Rejection Reason**: Required when rejecting, must be 10-1000 characters
5. **Audit Trail**: All moderation actions are timestamped with the moderator's ID

## Testing

### E2E Tests (33 test cases)

```bash
npm run test:e2e -- --testPathPatterns=moderation
```

**Test Coverage:**
- ✅ Submit endpoint (6 tests)
  - Owner can submit draft event
  - Non-owner cannot submit
  - Cannot submit already submitted event (409)
  - Cannot submit approved event (400)
  - 404 for non-existent event
  - 401 without authentication

- ✅ Approve endpoint (6 tests)
  - Moderator can approve submitted event
  - Admin can approve submitted event
  - Regular user cannot approve (403)
  - Cannot approve draft event (400)
  - Cannot approve already approved event (409)
  - Cannot approve rejected event directly (400)

- ✅ Reject endpoint (8 tests)
  - Moderator can reject with reason
  - Admin can reject with reason
  - Regular user cannot reject (403)
  - Rejection reason required (400)
  - Rejection reason minimum length (400)
  - Cannot reject draft event (400)
  - Cannot reject already rejected event (409)
  - Cannot reject approved event (400)

- ✅ Revert to draft (4 tests)
  - Owner can revert rejected event
  - Non-owner cannot revert (403)
  - Cannot revert draft event (400)
  - Cannot revert approved event (400)

- ✅ Pending events list (4 tests)
  - Moderator can view pending
  - Admin can view pending
  - Regular user cannot view (403)
  - Pagination works

- ✅ Status endpoint (3 tests)
  - Returns moderation status
  - Includes rejection info for rejected events
  - 404 for non-existent event

- ✅ Full workflow tests (2 tests)
  - Submit → Approve workflow
  - Submit → Reject → Revert → Resubmit → Approve workflow

## Files Changed

### Created
- `src/modules/moderation/moderation.module.ts`
- `src/modules/moderation/index.ts`
- `src/modules/moderation/controllers/moderation.controller.ts`
- `src/modules/moderation/services/moderation.service.ts`
- `src/modules/moderation/dto/index.ts`
- `src/modules/moderation/dto/reject-event.dto.ts`
- `src/modules/moderation/dto/moderation-response.dto.ts`
- `test/moderation.e2e-spec.ts`

### Modified
- `src/modules/events/entities/event.entity.ts` - Extended enum, added audit fields
- `src/app.module.ts` - Registered ModerationModule
- `src/modules/events/dto/query-events.dto.ts` - Updated enum validation message
- `src/modules/events/dto/create-event.dto.ts` - Updated enum validation message

## Definition of Done ✅

- [x] Submit/Approve/Reject endpoints implemented
- [x] Enforce allowed status transitions (state machine)
- [x] Reject reason field with validation (10-1000 chars)
- [x] Audit fields (timestamps + moderator tracking)
- [x] Invalid transitions return 400/409 with clear messages
- [x] Moderator/admin role check for approve/reject
- [x] Owner check for submit/revert
- [x] E2E tests validate complete workflow (33 tests passing)
- [x] Swagger documentation for all endpoints

## Next Steps (Day 9+)

- Add notification system for moderation events
- Email owner when event is approved/rejected
- Add moderation history/audit log endpoint
- Implement bulk moderation actions
- Add moderation dashboard metrics
