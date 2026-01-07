import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Response } from 'express';

/**
 * Timing Interceptor
 * 
 * Adds X-Response-Time header to all responses with execution duration.
 * This is useful for:
 * - Performance monitoring and debugging
 * - Client-side performance tracking
 * - Identifying slow endpoints
 * 
 * Note: This interceptor measures the time from when the request
 * enters the interceptor chain until the response is ready.
 * It does NOT include middleware execution time.
 */
@Injectable()
export class TimingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse<Response>();
        const duration = Date.now() - startTime;
        
        // Add timing header if headers haven't been sent
        if (!response.headersSent) {
          response.setHeader('X-Response-Time', `${duration}ms`);
        }
      }),
    );
  }
}
