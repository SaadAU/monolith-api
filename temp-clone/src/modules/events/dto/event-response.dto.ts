import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Type } from 'class-transformer';
import { EventStatus } from '../entities/event.entity';

/**
 * Minimal user info for event responses
 * Avoids leaking sensitive user data
 */
class EventCreatorDto {
  @Expose()
  @ApiProperty({ description: 'Creator user ID' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Creator name' })
  name!: string;
}

/**
 * Response DTO for Event
 * Maps entity to safe response, excluding internal fields
 */
@Exclude()
export class EventResponseDto {
  @Expose()
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Event title' })
  title!: string;

  @Expose()
  @ApiProperty({ description: 'Event description', required: false })
  description?: string;

  @Expose()
  @ApiProperty({ description: 'Event location/venue', required: false })
  location?: string;

  @Expose()
  @ApiProperty({ description: 'Event start date and time' })
  startDate!: Date;

  @Expose()
  @ApiProperty({ description: 'Event end date and time', required: false })
  endDate?: Date;

  @Expose()
  @ApiProperty({ description: 'Event status', enum: EventStatus })
  status!: EventStatus;

  @Expose()
  @ApiProperty({ description: 'Maximum number of attendees', required: false })
  maxAttendees?: number;

  @Expose()
  @ApiProperty({ description: 'Is the event virtual/online?' })
  isVirtual!: boolean;

  @Expose()
  @ApiProperty({ description: 'Virtual event URL', required: false })
  virtualUrl?: string;

  @Expose()
  @ApiProperty({ description: 'Organization ID' })
  orgId!: string;

  @Expose()
  @ApiProperty({ description: 'Creator user ID' })
  createdById!: string;

  @Expose()
  @Type(() => EventCreatorDto)
  @ApiProperty({
    description: 'Creator information',
    type: EventCreatorDto,
    required: false,
  })
  createdBy?: EventCreatorDto;

  @Expose()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

/**
 * Pagination metadata for cursor-based pagination
 */
export class CursorPaginationMeta {
  @ApiProperty({
    description: 'Cursor to fetch next page (null if no more pages)',
  })
  nextCursor!: string | null;

  @ApiProperty({
    description: 'Cursor to fetch previous page (null if on first page)',
  })
  prevCursor!: string | null;

  @ApiProperty({ description: 'Whether there are more items after this page' })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether there are items before this page' })
  hasPrevPage!: boolean;

  @ApiProperty({ description: 'Number of items in current response' })
  count!: number;
}

/**
 * Pagination metadata for offset-based pagination
 */
export class OffsetPaginationMeta {
  @ApiProperty({ description: 'Total number of items matching the query' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit!: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages!: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNextPage!: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrevPage!: boolean;
}

/**
 * Response DTO for paginated event list with cursor-based pagination
 * Preferred for feeds, infinite scroll, real-time data
 */
export class EventListResponseDto {
  @ApiProperty({ description: 'List of events', type: [EventResponseDto] })
  data!: EventResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata (cursor-based)',
    type: CursorPaginationMeta,
  })
  pagination!: CursorPaginationMeta;

  @ApiPropertyOptional({
    description:
      'Total count (only included with offset pagination or when explicitly requested)',
    required: false,
  })
  total?: number;
}

/**
 * Response DTO for paginated event list with offset-based pagination
 * Useful for admin tables, page navigation
 */
export class EventListOffsetResponseDto {
  @ApiProperty({ description: 'List of events', type: [EventResponseDto] })
  data!: EventResponseDto[];

  @ApiProperty({
    description: 'Pagination metadata (offset-based)',
    type: OffsetPaginationMeta,
  })
  pagination!: OffsetPaginationMeta;
}

/**
 * Legacy response format for backwards compatibility
 * @deprecated Use EventListResponseDto instead
 */
export class EventListLegacyResponseDto {
  @ApiProperty({ description: 'List of events', type: [EventResponseDto] })
  data!: EventResponseDto[];

  @ApiProperty({ description: 'Total number of events' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit!: number;
}
