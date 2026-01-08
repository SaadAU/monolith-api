import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * Standard API response envelope format
 * Provides consistent structure for all successful responses
 */
export interface ApiResponseEnvelope<T> {
  /** Indicates request was successful */
  success: true;
  /** The actual response data */
  data: T;
  /** Optional metadata for the response */
  meta?: ResponseMeta;
}

/**
 * Response metadata for pagination, timing, etc.
 */
export interface ResponseMeta {
  /** ISO timestamp of the response */
  timestamp: string;
  /** Request path */
  path: string;
  /** Request correlation/trace ID */
  requestId?: string;
  /** Pagination info if applicable */
  pagination?: PaginationMeta;
}

/**
 * Pagination metadata
 */
export interface PaginationMeta {
  /** Current page (for offset pagination) */
  page?: number;
  /** Items per page */
  limit?: number;
  /** Total number of items */
  total?: number;
  /** Total number of pages */
  totalPages?: number;
  /** Next cursor (for cursor pagination) */
  nextCursor?: string;
  /** Has more items */
  hasMore?: boolean;
}

/**
 * Metadata key for skipping the response envelope
 */
export const SKIP_ENVELOPE_KEY = 'skipResponseEnvelope';

/**
 * Decorator to skip the response envelope for specific handlers
 * 
 * @example
 * ```typescript
 * @Get('raw')
 * @SkipEnvelope()
 * getRawData() {
 *   return { raw: 'data' };
 * }
 * ```
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);

/**
 * Metadata key for pagination info
 */
export const PAGINATION_META_KEY = 'paginationMeta';

/**
 * Decorator to set pagination metadata on responses
 * Use this in controllers that return paginated data
 */
export const SetPaginationMeta = (meta: PaginationMeta) =>
  SetMetadata(PAGINATION_META_KEY, meta);

/**
 * Response Envelope Interceptor
 * 
 * Wraps all successful responses in a consistent envelope format:
 * ```json
 * {
 *   "success": true,
 *   "data": { ... },
 *   "meta": {
 *     "timestamp": "2024-01-01T00:00:00.000Z",
 *     "path": "/api/resource",
 *     "requestId": "abc-123"
 *   }
 * }
 * ```
 * 
 * Features:
 * - Consistent response structure across all endpoints
 * - Automatic timestamp and request ID injection
 * - Support for pagination metadata
 * - Can be skipped with @SkipEnvelope() decorator
 * 
 * Note: Error responses are handled by exception filters and
 * maintain their own consistent format.
 */
@Injectable()
export class ResponseEnvelopeInterceptor<T>
  implements NestInterceptor<T, ApiResponseEnvelope<T> | T>
{
  constructor(private readonly reflector: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponseEnvelope<T> | T> {
    // Check if envelope should be skipped for this handler
    const skipEnvelope = this.reflector.getAllAndOverride<boolean>(
      SKIP_ENVELOPE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (skipEnvelope) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();

    // Get pagination metadata if set
    const paginationMeta = this.reflector.get<PaginationMeta>(
      PAGINATION_META_KEY,
      context.getHandler(),
    );

    return next.handle().pipe(
      map((data) => {
        // Handle cases where data already includes pagination
        let responseData = data;
        let pagination = paginationMeta;

        // If response contains items array with pagination info, extract it
        if (this.isPaginatedResponse(data)) {
          responseData = data;
          pagination = {
            total: data.total,
            page: data.page,
            limit: data.limit,
            totalPages: data.totalPages,
            hasMore: data.hasMore,
            nextCursor: data.nextCursor,
          };
        }

        const meta: ResponseMeta = {
          timestamp: new Date().toISOString(),
          path: request.url,
          requestId: request.requestId,
        };

        if (pagination) {
          meta.pagination = pagination;
        }

        return {
          success: true as const,
          data: responseData,
          meta,
        };
      }),
    );
  }

  /**
   * Check if the response looks like a paginated response
   */
  private isPaginatedResponse(
    data: unknown,
  ): data is { items: unknown[]; total?: number; page?: number; limit?: number; totalPages?: number; hasMore?: boolean; nextCursor?: string } {
    return (
      typeof data === 'object' &&
      data !== null &&
      'items' in data &&
      Array.isArray((data as { items: unknown[] }).items)
    );
  }
}
