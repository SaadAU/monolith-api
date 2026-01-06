import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { EventStatus } from '../../events/entities/event.entity';

/**
 * Simplified user info for moderation responses
 */
class ModeratorInfoDto {
  @Expose()
  @ApiProperty({ description: 'Moderator ID' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Moderator name' })
  name!: string;
}

/**
 * Response DTO for moderation actions
 */
export class ModerationResponseDto {
  @Expose()
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @Expose()
  @ApiProperty({ description: 'Event title' })
  title!: string;

  @Expose()
  @ApiProperty({ description: 'Current event status', enum: EventStatus })
  status!: EventStatus;

  @Expose()
  @ApiProperty({ description: 'Previous event status', enum: EventStatus })
  previousStatus!: EventStatus;

  @Expose()
  @ApiProperty({ description: 'Rejection reason (if rejected)', required: false })
  rejectionReason?: string;

  @Expose()
  @ApiProperty({ description: 'When the event was submitted', required: false })
  submittedAt?: Date;

  @Expose()
  @ApiProperty({ description: 'When the event was approved', required: false })
  approvedAt?: Date;

  @Expose()
  @ApiProperty({ description: 'When the event was rejected', required: false })
  rejectedAt?: Date;

  @Expose()
  @Type(() => ModeratorInfoDto)
  @ApiProperty({ description: 'Moderator info', type: ModeratorInfoDto, required: false })
  moderatedBy?: ModeratorInfoDto;

  @Expose()
  @ApiProperty({ description: 'Action performed' })
  action!: string;

  @Expose()
  @ApiProperty({ description: 'Human-readable message' })
  message!: string;
}

/**
 * Response for listing events pending moderation
 */
export class PendingModerationListDto {
  @Expose()
  @ApiProperty({ description: 'List of events pending moderation', type: [ModerationResponseDto] })
  data!: ModerationResponseDto[];

  @Expose()
  @ApiProperty({ description: 'Total count of pending events' })
  total!: number;

  @Expose()
  @ApiProperty({ description: 'Current page' })
  page!: number;

  @Expose()
  @ApiProperty({ description: 'Items per page' })
  limit!: number;
}
