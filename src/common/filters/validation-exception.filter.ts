import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Detailed validation error for a specific field
 */
export interface ValidationFieldError {
  /** The field that failed validation */
  field: string;
  /** The invalid value (sanitized) */
  value?: unknown;
  /** Array of constraint violations */
  constraints: string[];
}

/**
 * Structured validation error response
 */
export interface ValidationErrorResponse {
  statusCode: number;
  error: 'Validation Error';
  message: string;
  /** Detailed per-field errors */
  details: ValidationFieldError[];
  path: string;
  timestamp: string;
}

/**
 * Validation Exception Filter
 * 
 * Provides enhanced error responses for validation failures.
 * Transforms class-validator errors into a structured format
 * that's easy to consume on the client side.
 * 
 * Features:
 * - Groups errors by field
 * - Provides the invalid value (sanitized)
 * - Lists all constraint violations per field
 * - Works with nested validation errors
 * 
 * Example response:
 * ```json
 * {
 *   "statusCode": 400,
 *   "error": "Validation Error",
 *   "message": "Validation failed for 3 field(s)",
 *   "details": [
 *     {
 *       "field": "email",
 *       "value": "invalid-email",
 *       "constraints": ["email must be a valid email address"]
 *     },
 *     {
 *       "field": "age",
 *       "value": -5,
 *       "constraints": ["age must be a positive number"]
 *     }
 *   ],
 *   "path": "/api/users",
 *   "timestamp": "2024-01-01T00:00:00.000Z"
 * }
 * ```
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // Check if this is a validation error from class-validator
    if (this.isValidationError(exceptionResponse)) {
      const validationErrors = this.extractValidationErrors(exceptionResponse);
      
      const errorResponse: ValidationErrorResponse = {
        statusCode: status,
        error: 'Validation Error',
        message: `Validation failed for ${validationErrors.length} field(s)`,
        details: validationErrors,
        path: request.url,
        timestamp: new Date().toISOString(),
      };

      this.logger.warn(
        `Validation failed: ${request.method} ${request.url} - ${JSON.stringify(validationErrors.map(e => e.field))}`,
      );

      response.status(status).json(errorResponse);
      return;
    }

    // Not a validation error, re-throw to let HttpExceptionFilter handle it
    throw exception;
  }

  /**
   * Check if the exception response looks like a validation error
   */
  private isValidationError(response: unknown): response is { message: string[] | string } {
    if (typeof response !== 'object' || response === null) {
      return false;
    }

    const resp = response as Record<string, unknown>;
    
    // class-validator errors come as an array of messages
    if (Array.isArray(resp.message) && resp.message.length > 0) {
      // Check if messages look like validation errors
      return resp.message.some(
        (msg: unknown) => typeof msg === 'string' && this.looksLikeValidationMessage(msg),
      );
    }

    return false;
  }

  /**
   * Heuristic to detect if a message looks like a validation error
   */
  private looksLikeValidationMessage(message: string): boolean {
    const validationPatterns = [
      /must be/i,
      /should be/i,
      /must not/i,
      /should not/i,
      /is not valid/i,
      /is required/i,
      /is not allowed/i,
      /must contain/i,
      /cannot be/i,
      /expected/i,
    ];

    return validationPatterns.some((pattern) => pattern.test(message));
  }

  /**
   * Extract structured validation errors from exception response
   */
  private extractValidationErrors(
    response: { message: string[] | string },
  ): ValidationFieldError[] {
    const messages = Array.isArray(response.message)
      ? response.message
      : [response.message];

    // Group errors by field
    const fieldErrorMap = new Map<string, string[]>();

    for (const message of messages) {
      const field = this.extractFieldFromMessage(message);
      const existing = fieldErrorMap.get(field) ?? [];
      existing.push(message);
      fieldErrorMap.set(field, existing);
    }

    // Convert to array of ValidationFieldError
    const errors: ValidationFieldError[] = [];
    for (const [field, constraints] of fieldErrorMap) {
      errors.push({
        field,
        constraints,
      });
    }

    return errors;
  }

  /**
   * Try to extract the field name from a validation message
   * Most class-validator messages start with the property name
   */
  private extractFieldFromMessage(message: string): string {
    // Common patterns: "email must be...", "name should not be..."
    const match = message.match(/^(\w+)\s+(must|should|is|cannot|has)/i);
    if (match) {
      return match[1];
    }

    // Nested field pattern: "user.email must be..."
    const nestedMatch = message.match(/^([\w.]+)\s+(must|should|is|cannot|has)/i);
    if (nestedMatch) {
      return nestedMatch[1];
    }

    // If we can't extract, use generic field
    return 'unknown';
  }
}
