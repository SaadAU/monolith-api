import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { IDomainEvent } from './domain-event.interface';

/**
 * Domain Event Emitter
 * Provides a type-safe wrapper around EventEmitter2 for domain events
 * This ensures all events follow the IDomainEvent interface
 */
@Injectable()
export class DomainEventEmitter {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  /**
   * Emit a domain event
   * @param event The domain event to emit
   */
  emit(event: IDomainEvent): void {
    this.eventEmitter.emit(event.eventName, event);
  }

  /**
   * Emit multiple domain events
   * @param events Array of domain events to emit
   */
  emitAll(events: IDomainEvent[]): void {
    events.forEach((event) => this.emit(event));
  }
}
