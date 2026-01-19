import { IDomainEvent } from '../../../common/events';
import { v4 as uuidv4 } from 'uuid';

/**
 * Event Status for moderation events
 */
export enum EventStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/**
 * Base class for event-related domain events
 */
abstract class BaseEventDomainEvent implements IDomainEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  abstract readonly eventName: string;

  constructor(
    public readonly aggregateId: string, // Event ID
    public readonly userId: string,
    public readonly orgId: string,
  ) {
    this.eventId = uuidv4();
    this.occurredAt = new Date();
  }
}

/**
 * Domain event emitted when an event is submitted for moderation
 */
export class EventSubmittedEvent extends BaseEventDomainEvent {
  readonly eventName = 'event.submitted';

  constructor(
    aggregateId: string,
    userId: string,
    orgId: string,
    public readonly eventTitle: string,
  ) {
    super(aggregateId, userId, orgId);
  }
}

/**
 * Domain event emitted when an event is approved
 */
export class EventApprovedEvent extends BaseEventDomainEvent {
  readonly eventName = 'event.approved';

  constructor(
    aggregateId: string,
    userId: string,
    orgId: string,
    public readonly moderatorId: string,
    public readonly eventTitle: string,
  ) {
    super(aggregateId, userId, orgId);
  }
}

/**
 * Domain event emitted when an event is rejected
 */
export class EventRejectedEvent extends BaseEventDomainEvent {
  readonly eventName = 'event.rejected';

  constructor(
    aggregateId: string,
    userId: string,
    orgId: string,
    public readonly moderatorId: string,
    public readonly eventTitle: string,
    public readonly reason?: string,
  ) {
    super(aggregateId, userId, orgId);
  }
}

/**
 * Domain event emitted when an event is reverted to draft
 */
export class EventRevertedToDraftEvent extends BaseEventDomainEvent {
  readonly eventName = 'event.reverted_to_draft';

  constructor(
    aggregateId: string,
    userId: string,
    orgId: string,
    public readonly eventTitle: string,
    public readonly previousStatus: EventStatus,
  ) {
    super(aggregateId, userId, orgId);
  }
}
