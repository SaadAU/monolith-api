import {
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsString,
  IsUUID,
  IsDateString,
  IsBoolean,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EventStatus } from '../entities/event.entity';

/**
 * Whitelisted sort fields - ONLY these fields can be used for sorting
 * This prevents:
 * - SQL injection via sort field
 * - Sorting by sensitive/internal fields
 * - Expensive sorts on non-indexed columns
 */
export enum EventSortField {
  START_DATE = 'startDate',
  CREATED_AT = 'createdAt',
  TITLE = 'title',
  STATUS = 'status',
  UPDATED_AT = 'updatedAt',
}

/**
 * Sort order options
 */
export enum SortOrder {
  ASC = 'ASC',
  DESC = 'DESC',
}

/**
 * Pagination type - cursor is preferred for performance
 */
export enum PaginationType {
  CURSOR = 'cursor',
  OFFSET = 'offset',
}

/**
 * Query parameters for filtering, sorting, and paginating events
 *
 * Security features:
 * - All parameters are validated and sanitized
 * - Sort fields are whitelisted (only indexed columns)
 * - Search is limited in length to prevent DoS
 * - Unknown parameters are rejected (forbidNonWhitelisted in ValidationPipe)
 *
 * Pagination:
 * - Supports both cursor-based (preferred) and offset-based pagination
 * - Cursor-based: Use 'cursor' param (base64-encoded event ID + timestamp)
 * - Offset-based: Use 'page' and 'limit' params
 */
export class QueryEventsDto {
  // ============================================
  // FILTER OPTIONS (Whitelisted)
  // ============================================

  @IsOptional()
  @IsEnum(EventStatus, {
    message: `Status must be one of: ${Object.values(EventStatus).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Filter by event status',
    enum: EventStatus,
    example: EventStatus.APPROVED,
  })
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @MaxLength(100, { message: 'Search query cannot exceed 100 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @ApiPropertyOptional({
    description: 'Search by title (case-insensitive partial match)',
    example: 'hackathon',
    maxLength: 100,
  })
  search?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDateFrom must be a valid ISO 8601 date' })
  @ApiPropertyOptional({
    description: 'Filter events starting from this date (inclusive)',
    example: '2026-01-01T00:00:00Z',
  })
  startDateFrom?: string;

  @IsOptional()
  @IsDateString({}, { message: 'startDateTo must be a valid ISO 8601 date' })
  @ApiPropertyOptional({
    description: 'Filter events starting before this date (inclusive)',
    example: '2026-12-31T23:59:59Z',
  })
  startDateTo?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return value;
  })
  @IsBoolean({ message: 'isVirtual must be a boolean value' })
  @ApiPropertyOptional({
    description: 'Filter by virtual/in-person events',
    example: true,
  })
  isVirtual?: boolean;

  @IsOptional()
  @IsUUID('4', { message: 'createdById must be a valid UUID' })
  @ApiPropertyOptional({
    description: 'Filter by creator user ID',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  createdById?: string;

  // ============================================
  // SORTING OPTIONS (Whitelisted)
  // ============================================

  @IsOptional()
  @IsEnum(EventSortField, {
    message: `sortBy must be one of: ${Object.values(EventSortField).join(', ')}`,
  })
  @ApiPropertyOptional({
    description: 'Field to sort by (whitelisted options only)',
    enum: EventSortField,
    default: EventSortField.START_DATE,
  })
  sortBy?: EventSortField = EventSortField.START_DATE;

  @IsOptional()
  @IsEnum(SortOrder, {
    message: 'sortOrder must be either ASC or DESC',
  })
  @ApiPropertyOptional({
    description: 'Sort order',
    enum: SortOrder,
    default: SortOrder.ASC,
  })
  sortOrder?: SortOrder = SortOrder.ASC;

  // ============================================
  // PAGINATION OPTIONS
  // ============================================

  @IsOptional()
  @IsEnum(PaginationType, {
    message: 'paginationType must be either cursor or offset',
  })
  @ApiPropertyOptional({
    description: 'Pagination strategy to use',
    enum: PaginationType,
    default: PaginationType.CURSOR,
  })
  paginationType?: PaginationType = PaginationType.CURSOR;

  /**
   * Cursor for cursor-based pagination
   * Format: base64(JSON({ id, sortValue, sortField }))
   * This ensures stable pagination even when data changes
   */
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Cursor cannot exceed 500 characters' })
  @ApiPropertyOptional({
    description:
      'Cursor for pagination (from previous response). Use for efficient infinite scroll.',
    example:
      'eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCIsInNvcnRWYWx1ZSI6IjIwMjYtMDEtMTVUMTA6MDA6MDBaIiwic29ydEZpZWxkIjoic3RhcnREYXRlIn0=',
  })
  cursor?: string;

  /**
   * Page number for offset-based pagination
   * Only used when paginationType is 'offset'
   */
  @IsOptional()
  @ValidateIf((o) => o.paginationType === PaginationType.OFFSET || !o.cursor)
  @Type(() => Number)
  @IsInt({ message: 'Page must be an integer' })
  @Min(1, { message: 'Page must be at least 1' })
  @ApiPropertyOptional({
    description: 'Page number (for offset pagination)',
    default: 1,
    minimum: 1,
  })
  page?: number = 1;

  /**
   * Number of items per page
   * Limited to prevent excessive data fetching
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Limit must be an integer' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100 items' })
  @ApiPropertyOptional({
    description: 'Number of items per page (max 100)',
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  limit?: number = 20;
}

/**
 * Decoded cursor structure for cursor-based pagination
 * Used internally by the service
 */
export interface DecodedCursor {
  id: string;
  sortValue: string | number | Date;
  sortField: EventSortField;
}
