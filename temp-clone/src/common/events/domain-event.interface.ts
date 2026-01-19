/**
 * Base interface for all domain events
 * Domain events represent something that happened in the domain
 */
export interface IDomainEvent {
  /**
   * Unique identifier for the event occurrence
   */
  eventId: string;

  /**
   * Timestamp when the event occurred
   */
  occurredAt: Date;

  /**
   * Name of the event (e.g., 'event.submitted', 'event.approved')
   */
  eventName: string;

  /**
   * The aggregate ID related to this event
   */
  aggregateId: string;
}
