/**
 * Idempotency utilities for handling duplicate requests
 * Ensures that a command with the same idempotency key produces the same result
 */

import { createHash } from 'crypto';

export interface IdempotencyRecord {
  idempotencyKey: string;

  result: unknown;
  createdAt: Date;
  expiresAt: Date;
}

/**
 * In-memory idempotency cache
 * In production, use Redis or persistent storage
 */
export class IdempotencyCache {
  private cache: Map<string, IdempotencyRecord> = new Map();
  private readonly ttlMs: number = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Get cached result for an idempotency key
   */

  get(key: string): unknown {
    const record = this.cache.get(key);
    if (!record) return null;

    // Check if expired
    if (new Date() > record.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return record.result;
  }

  /**
   * Store result for an idempotency key
   */

  set(key: string, result: unknown): void {
    const now = new Date();
    this.cache.set(key, {
      idempotencyKey: key,
      result,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.ttlMs),
    });
  }

  /**
   * Check if a key exists and is valid
   */
  has(key: string): boolean {
    const record = this.cache.get(key);
    if (!record) return false;

    if (new Date() > record.expiresAt) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear expired entries (for maintenance)
   */
  cleanup(): void {
    const now = new Date();
    const keysToDelete: string[] = [];

    for (const [key, record] of this.cache.entries()) {
      if (now > record.expiresAt) {
        keysToDelete.push(key);
      }
    }

    keysToDelete.forEach((key) => this.cache.delete(key));
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      ttlMs: this.ttlMs,
    };
  }
}

/**
 * Global idempotency cache instance
 * In production, inject this as a singleton service
 */
export const idempotencyCache = new IdempotencyCache();

/**
 * Helper function to generate an idempotency key from request data
 * Combines operation name and data hash
 */

export function generateIdempotencyKey(
  operation: string,
  data: unknown,
): string {
  const dataStr = JSON.stringify(data);

  const hash = createHash('sha256').update(dataStr).digest('hex');
  return `${operation}:${hash}`;
}
