import {
  PipeTransform,
  Injectable,
  BadRequestException,
} from '@nestjs/common';

/**
 * Parse Integer Pipe
 * 
 * Parses a string value to an integer with validation.
 * More flexible than Nest's built-in ParseIntPipe.
 * 
 * Features:
 * - Optional values (returns undefined instead of throwing)
 * - Configurable min/max bounds
 * - Custom error messages
 * - Handles edge cases (NaN, Infinity, floats)
 * 
 * @example
 * ```typescript
 * @Get(':id')
 * findOne(@Param('id', new ParseIntPipe({ min: 1 })) id: number) { }
 * 
 * @Get()
 * findAll(@Query('page', new ParseIntPipe({ optional: true, min: 1 })) page?: number) { }
 * ```
 */
export interface ParseIntPipeOptions {
  /** If true, undefined/null values are allowed */
  optional?: boolean;
  /** Minimum allowed value */
  min?: number;
  /** Maximum allowed value */
  max?: number;
  /** Custom error message */
  errorMessage?: string;
  /** Parameter name for error messages */
  paramName?: string;
}

@Injectable()
export class ParseIntPipe implements PipeTransform<string, number | undefined> {
  constructor(private readonly options: ParseIntPipeOptions = {}) {}

  transform(value: string): number | undefined {
    const { optional = false, min, max, errorMessage, paramName = 'value' } = this.options;

    // Handle optional values
    if (value === undefined || value === null || value === '') {
      if (optional) {
        return undefined;
      }
      throw new BadRequestException(
        errorMessage ?? `${paramName} is required`,
      );
    }

    const parsed = parseInt(value, 10);

    // Check if parsing failed
    if (isNaN(parsed)) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must be a valid integer`,
      );
    }

    // Check if value was a float
    if (parsed !== parseFloat(value)) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must be an integer, not a float`,
      );
    }

    // Check bounds
    if (min !== undefined && parsed < min) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must be at least ${min}`,
      );
    }

    if (max !== undefined && parsed > max) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must be at most ${max}`,
      );
    }

    return parsed;
  }
}

/**
 * Parse Boolean Pipe
 * 
 * Parses string values to boolean with flexible input handling.
 * 
 * Accepted truthy values: 'true', '1', 'yes', 'on'
 * Accepted falsy values: 'false', '0', 'no', 'off'
 * 
 * @example
 * ```typescript
 * @Get()
 * findAll(@Query('active', new ParseBoolPipe({ optional: true })) active?: boolean) { }
 * ```
 */
export interface ParseBoolPipeOptions {
  /** If true, undefined/null values are allowed */
  optional?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Parameter name for error messages */
  paramName?: string;
}

@Injectable()
export class ParseBoolPipe implements PipeTransform<string, boolean | undefined> {
  private readonly truthyValues = ['true', '1', 'yes', 'on'];
  private readonly falsyValues = ['false', '0', 'no', 'off'];

  constructor(private readonly options: ParseBoolPipeOptions = {}) {}

  transform(value: string): boolean | undefined {
    const { optional = false, errorMessage, paramName = 'value' } = this.options;

    // Handle optional values
    if (value === undefined || value === null || value === '') {
      if (optional) {
        return undefined;
      }
      throw new BadRequestException(
        errorMessage ?? `${paramName} is required`,
      );
    }

    const normalized = value.toLowerCase().trim();

    if (this.truthyValues.includes(normalized)) {
      return true;
    }

    if (this.falsyValues.includes(normalized)) {
      return false;
    }

    throw new BadRequestException(
      errorMessage ?? `${paramName} must be a boolean value (true/false, 1/0, yes/no)`,
    );
  }
}

/**
 * Parse Enum Pipe
 * 
 * Validates that a string value is a member of a specific enum.
 * 
 * @example
 * ```typescript
 * enum Status { ACTIVE = 'active', INACTIVE = 'inactive' }
 * 
 * @Get()
 * findByStatus(@Query('status', new ParseEnumPipe(Status)) status: Status) { }
 * ```
 */
export interface ParseEnumPipeOptions {
  /** If true, undefined/null values are allowed */
  optional?: boolean;
  /** Custom error message */
  errorMessage?: string;
  /** Parameter name for error messages */
  paramName?: string;
}

@Injectable()
export class ParseEnumPipe<T extends Record<string, string | number>>
  implements PipeTransform<string, T[keyof T] | undefined>
{
  constructor(
    private readonly enumType: T,
    private readonly options: ParseEnumPipeOptions = {},
  ) {}

  transform(value: string): T[keyof T] | undefined {
    const { optional = false, errorMessage, paramName = 'value' } = this.options;

    // Handle optional values
    if (value === undefined || value === null || value === '') {
      if (optional) {
        return undefined;
      }
      throw new BadRequestException(
        errorMessage ?? `${paramName} is required`,
      );
    }

    const enumValues = Object.values(this.enumType);
    
    // Check if value is valid (case-insensitive for string enums)
    const found = enumValues.find((enumValue) => {
      if (typeof enumValue === 'string') {
        return enumValue.toLowerCase() === value.toLowerCase();
      }
      return String(enumValue) === value;
    });

    if (found === undefined) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must be one of: ${enumValues.join(', ')}`,
      );
    }

    return found as T[keyof T];
  }
}

/**
 * Parse Array Pipe
 * 
 * Parses comma-separated values or repeated query params into an array.
 * 
 * @example
 * ```typescript
 * // Handles: ?ids=1,2,3 or ?ids=1&ids=2&ids=3
 * @Get()
 * findByIds(@Query('ids', new ParseArrayPipe({ itemType: 'number' })) ids: number[]) { }
 * ```
 */
export interface ParseArrayPipeOptions {
  /** Type of items in the array */
  itemType?: 'string' | 'number' | 'uuid';
  /** Separator for string values (default: ',') */
  separator?: string;
  /** If true, undefined/null values return empty array */
  optional?: boolean;
  /** Minimum array length */
  minLength?: number;
  /** Maximum array length */
  maxLength?: number;
  /** Custom error message */
  errorMessage?: string;
  /** Parameter name for error messages */
  paramName?: string;
}

@Injectable()
export class ParseArrayPipe<T = string>
  implements PipeTransform<string | string[], T[]>
{
  private readonly uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  constructor(private readonly options: ParseArrayPipeOptions = {}) {}

  transform(value: string | string[]): T[] {
    const {
      itemType = 'string',
      separator = ',',
      optional = false,
      minLength,
      maxLength,
      errorMessage,
      paramName = 'value',
    } = this.options;

    // Handle optional values
    if (value === undefined || value === null || value === '') {
      if (optional) {
        return [];
      }
      throw new BadRequestException(
        errorMessage ?? `${paramName} is required`,
      );
    }

    // Convert to array
    let items: string[];
    if (Array.isArray(value)) {
      items = value;
    } else {
      items = value.split(separator).map((s) => s.trim()).filter(Boolean);
    }

    // Validate length
    if (minLength !== undefined && items.length < minLength) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must contain at least ${minLength} items`,
      );
    }

    if (maxLength !== undefined && items.length > maxLength) {
      throw new BadRequestException(
        errorMessage ?? `${paramName} must contain at most ${maxLength} items`,
      );
    }

    // Transform and validate items
    const result: T[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      switch (itemType) {
        case 'number': {
          const num = parseInt(item, 10);
          if (isNaN(num)) {
            throw new BadRequestException(
              errorMessage ?? `${paramName}[${i}] must be a valid number`,
            );
          }
          result.push(num as T);
          break;
        }
        case 'uuid': {
          if (!this.uuidRegex.test(item)) {
            throw new BadRequestException(
              errorMessage ?? `${paramName}[${i}] must be a valid UUID`,
            );
          }
          result.push(item as T);
          break;
        }
        default:
          result.push(item as T);
      }
    }

    return result;
  }
}
