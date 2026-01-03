import { ApiProperty } from '@nestjs/swagger';
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
  @ApiProperty({ description: 'Creator information', type: EventCreatorDto, required: false })
  createdBy?: EventCreatorDto;

  @Expose()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @Expose()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

/**
 * Response DTO for paginated event list
 */
export class EventListResponseDto {
  @ApiProperty({ description: 'List of events', type: [EventResponseDto] })
  data!: EventResponseDto[];

  @ApiProperty({ description: 'Total number of events' })
  total!: number;

  @ApiProperty({ description: 'Current page number' })
  page!: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit!: number;
}
