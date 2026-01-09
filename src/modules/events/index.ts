/**
 * Events Module Public API
 *
 * This module is responsible for managing event entities and their lifecycle.
 *
 * Public Exports:
 * - EventsModule: NestJS module for dependency injection
 * - EventsService: Service for event CRUD operations
 * - Event: Event entity
 * - EventStatus: Event status enum
 * - DTOs: For external API consumption only
 *
 * Internal (not exported):
 * - EventsController: HTTP endpoints (internal to module)
 *
 * Module Boundaries:
 * - This module owns the Event entity and its lifecycle
 * - Other modules should use EventsService for event operations
 * - Do NOT directly access the EventRepository from other modules
 */

export { EventsModule } from './events.module';
export { Event, EventStatus } from './entities/event.entity';
export { EventsService } from './services/events.service';
export {
  CreateEventDto,
  UpdateEventDto,
  EventResponseDto,
  EventListResponseDto,
  QueryEventsDto,
} from './dto';
