import { timeout, retry, catchError } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';

/**
 * Retry configuration for microservice calls
 */
export interface RetryConfig {
  maxRetries: number;
  delayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
}

/**
 * Default retry configuration for microservice resilience
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  delayMs: 100,
  backoffMultiplier: 2,
  timeoutMs: 5000, // 5 seconds
};

/**
 * Applies timeout and retry logic to an observable
 * Implements exponential backoff: delay * (backoffMultiplier ^ attempt)
 *
 * @param observable - The RxJS observable to apply retry logic to
 * @param config - Retry configuration
 * @returns Observable with retry and timeout applied
 */
export function applyRetryLogic<T>(
  observable: Observable<T>,
  config: Partial<RetryConfig> = {},
): Observable<T> {
  const finalConfig = { ...DEFAULT_RETRY_CONFIG, ...config };

  return observable.pipe(
    timeout(finalConfig.timeoutMs),
    retry({
      count: finalConfig.maxRetries,

      delay: (error: any, retryCount: number) => {
        // Calculate exponential backoff
        const delayMs =
          finalConfig.delayMs *
          Math.pow(finalConfig.backoffMultiplier, retryCount);

        const errorMsg =
          error instanceof Error ? error.message : 'Unknown error';
        console.log(
          `Retry attempt ${retryCount + 1}/${finalConfig.maxRetries} ` +
            `after ${delayMs}ms. Error: ${errorMsg}`,
        );

        return new Promise((resolve) => setTimeout(resolve, delayMs));
      },
    }),
    catchError((error: unknown) => {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      console.error('All retry attempts failed:', errorMsg);
      return throwError(() => error);
    }),
  );
}

/**
 * Extracts the actual error message from RxJS error
 */
export function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error';
}
