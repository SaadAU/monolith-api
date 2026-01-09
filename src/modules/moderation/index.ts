/**
 * Moderation Module Public API
 * 
 * This module is responsible for event moderation workflow and state transitions.
 * 
 * Public Exports:
 * - ModerationModule: NestJS module for dependency injection
 * - ModerationService: Service for moderation operations
 * - Domain Events: Events emitted during moderation workflow
 * - DTOs: For external API consumption
 * 
 * Internal (not exported):
 * - ModerationController: HTTP endpoints (internal to module)
 * - Event Listeners: Internal event handlers
 * 
 * Module Boundaries:
 * - This module manages event state transitions (DRAFT → SUBMITTED → APPROVED/REJECTED)
 * - Emits domain events for decoupling from other modules
 * - Other modules should listen to domain events, not call ModerationService directly
 * - Access control is enforced within this module
 */

export * from './moderation.module';
export * from './services/moderation.service';
export * from './dto';

// Domain Events (for other modules to listen to)
export * from './events';
