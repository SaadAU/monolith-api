/* eslint-disable @typescript-eslint/no-unsafe-return */
import {
  PipeTransform,
  Injectable,
  ArgumentMetadata,
  BadRequestException,
} from '@nestjs/common';
import { plainToInstance, ClassConstructor } from 'class-transformer';
import { validate, ValidationError } from 'class-validator';

/**
 * Query Params Validation Pipe
 *
 * A specialized pipe for validating and transforming query parameters.
 * This pipe provides stricter handling of query params compared to the
 * global ValidationPipe, with features specific to query string handling.
 *
 * Features:
 * - Validates query params against a DTO class
 * - Transforms string values to proper types (numbers, booleans, etc.)
 * - Sanitizes string inputs (trims whitespace)
 * - Provides clear error messages for invalid params
 * - Handles arrays in query strings (e.g., ?ids=1&ids=2)
 *
 * Usage:
 * ```typescript
 * @Get()
 * async findAll(
 *   @Query(new QueryParamsValidationPipe()) query: QueryEventsDto,
 * ) {
 *   // query is validated and transformed
 * }
 * ```
 *
 * Note: For most cases, the global ValidationPipe handles query params.
 * Use this pipe when you need:
 * - Custom sanitization logic
 * - Stricter validation messages
 * - Query-specific transformations
 */
@Injectable()
export class QueryParamsValidationPipe implements PipeTransform {
  async transform(
    value: unknown,
    metadata: ArgumentMetadata,
  ): Promise<unknown> {
    // Only process query parameters with a metatype
    if (metadata.type !== 'query' || !metadata.metatype) {
      return value;
    }

    // Skip primitive types
    if (this.isPrimitive(metadata.metatype)) {
      return value;
    }

    // Sanitize input values
    const sanitized = this.sanitize(value as Record<string, unknown>);

    // Transform plain object to class instance
    const instance = plainToInstance(
      metadata.metatype as unknown as ClassConstructor<any>,
      sanitized,
      {
        enableImplicitConversion: true,
        exposeDefaultValues: true,
      },
    );

    // Validate the instance
    const errors = await validate(instance as object, {
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
    });

    if (errors.length > 0) {
      const messages = this.buildErrorMessages(errors);
      throw new BadRequestException({
        message: messages,
        error: 'Query Parameter Validation Failed',
      });
    }

    return instance;
  }

  /**
   * Sanitize query parameter values
   * - Trims whitespace from strings
   * - Converts empty strings to undefined
   * - Handles array values
   */
  private sanitize(value: Record<string, unknown>): Record<string, unknown> {
    if (!value || typeof value !== 'object') {
      return value as Record<string, unknown>;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (typeof val === 'string') {
        const trimmed = val.trim();
        // Convert empty strings to undefined so they're not validated
        sanitized[key] = trimmed === '' ? undefined : trimmed;
      } else if (Array.isArray(val)) {
        // Handle array values (e.g., ?ids=1&ids=2)
        sanitized[key] = val
          .map((item) => (typeof item === 'string' ? item.trim() : item))
          .filter((item) => item !== '');
      } else {
        sanitized[key] = val;
      }
    }

    return sanitized;
  }

  /**
   * Build user-friendly error messages from validation errors
   */
  private buildErrorMessages(errors: ValidationError[]): string[] {
    const messages: string[] = [];

    for (const error of errors) {
      if (error.constraints) {
        messages.push(...Object.values(error.constraints));
      }
      if (error.children && error.children.length > 0) {
        messages.push(...this.buildErrorMessages(error.children));
      }
    }

    return messages;
  }

  /**
   * Check if a type is a primitive type
   */
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private isPrimitive(metatype: Function | undefined): boolean {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    const primitives: (Function | undefined)[] = [
      String,
      Boolean,
      Number,
      Array,
      Object,
    ];
    return primitives.includes(metatype);
  }
}
