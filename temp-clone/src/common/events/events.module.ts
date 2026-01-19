import { Module, Global } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { DomainEventEmitter } from './domain-event-emitter';

/**
 * Global Events Module
 * Provides domain event infrastructure to all modules
 * This is a global module to avoid importing it in every module
 */
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      // Use this instance across the entire application
      wildcard: true,
      // The delimiter used to segment namespaces
      delimiter: '.',
      // Set this to `true` to use wildcards
      verboseMemoryLeak: true,
      // Set the maximum amount of listeners that can be assigned to an event
      maxListeners: 10,
      // Ignore the "unhandled event" warning (useful for optional events)
      ignoreErrors: false,
    }),
  ],
  providers: [DomainEventEmitter],
  exports: [DomainEventEmitter],
})
export class CommonEventsModule {}
