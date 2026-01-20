import { Injectable, BadRequestException } from '@nestjs/common';
import {
  idempotencyCache,
  generateIdempotencyKey,
} from '../../common/utils/idempotency.utility';

/**
 * Example: Idempotent Create Event Command Handler
 *
 * Demonstrates handling duplicate requests gracefully.
 *
 * Usage:
 * - Client includes an Idempotency-Key header
 * - If the same key is sent twice, the cached result is returned
 * - This prevents duplicate events from being created due to retries
 */
@Injectable()
export class IdempotentCreateEventHandler {
  /**
   * Process a create event command idempotently
   *
   * @param createEventData - Event creation payload
   * @param idempotencyKey - Unique key for this request (from header)
   * @param actualCreateFn - Function that actually creates the event
   * @returns Cached result or result of actualCreateFn
   */

  async handleCreateEventIdempotently(
    _createEventData: unknown,
    idempotencyKey: string,

    actualCreateFn: () => Promise<unknown>,
  ): Promise<unknown> {
    // Validate idempotency key format
    if (!idempotencyKey || idempotencyKey.trim().length === 0) {
      throw new BadRequestException(
        'Idempotency-Key header is required for create operations',
      );
    }

    // Check if we've already processed this request
    const cachedResult = idempotencyCache.get(idempotencyKey);
    if (cachedResult) {
      console.log(
        `[IDEMPOTENCY] Returning cached result for key: ${idempotencyKey}`,
      );
      return cachedResult;
    }

    // Process the request
    console.log(
      `[IDEMPOTENCY] Processing new request with key: ${idempotencyKey}`,
    );
    const result = await actualCreateFn();

    // Cache the result
    idempotencyCache.set(idempotencyKey, result);

    return result;
  }

  /**
   * Alternative: Process with automatic key generation from data
   * Useful when client doesn't provide an explicit key
   */

  async handleCreateEventIdempotentlyAuto(
    createEventData: unknown,
    operationName: string,

    actualCreateFn: () => Promise<unknown>,
  ): Promise<unknown> {
    const idempotencyKey = generateIdempotencyKey(
      operationName,
      createEventData,
    );

    // Check cache
    const cachedResult = idempotencyCache.get(idempotencyKey);
    if (cachedResult) {
      console.log(
        `[IDEMPOTENCY] Returning cached result for auto-generated key: ${idempotencyKey}`,
      );
      return cachedResult;
    }

    // Process
    console.log(
      `[IDEMPOTENCY] Processing with auto-generated key: ${idempotencyKey}`,
    );
    const result = await actualCreateFn();
    idempotencyCache.set(idempotencyKey, result);

    return result;
  }
}

/**
 * Example integration in an event service:
 *
 * @Injectable()
 * export class EventsService {
 *   constructor(
 *     private idempotentHandler: IdempotentCreateEventHandler,
 *     private eventsRepository: Repository<Event>,
 *   ) {}
 *
 *   async createEvent(
 *     createEventDto: CreateEventRequestDto,
 *     idempotencyKey: string,
 *   ) {
 *     return this.idempotentHandler.handleCreateEventIdempotently(
 *       createEventDto,
 *       idempotencyKey,
 *       async () => {
 *         // Actual event creation logic
 *         const event = this.eventsRepository.create(createEventDto);
 *         return this.eventsRepository.save(event);
 *       },
 *     );
 *   }
 * }
 */
