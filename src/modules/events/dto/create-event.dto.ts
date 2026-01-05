import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsDateString,
  IsEnum,
  IsInt,
  IsBoolean,
  IsUrl,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '../entities/event.entity';

export class CreateEventDto {
  @IsNotEmpty({ message: 'Event title is required' })
  @IsString()
  @MaxLength(200, { message: 'Title cannot exceed 200 characters' })
  @ApiProperty({ description: 'Event title', maxLength: 200, example: 'Annual Tech Conference 2026' })
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description cannot exceed 5000 characters' })
  @ApiProperty({ 
    description: 'Event description', 
    required: false, 
    example: 'Join us for our annual technology conference featuring industry leaders.' 
  })
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Location cannot exceed 255 characters' })
  @ApiProperty({ description: 'Event location/venue', required: false, example: 'Convention Center, Room 101' })
  location?: string;

  @IsNotEmpty({ message: 'Start date is required' })
  @IsDateString({}, { message: 'Start date must be a valid ISO 8601 date string' })
  @ApiProperty({ description: 'Event start date and time (ISO 8601)', example: '2026-03-15T09:00:00Z' })
  startDate!: string;

  @IsOptional()
  @IsDateString({}, { message: 'End date must be a valid ISO 8601 date string' })
  @ApiProperty({ description: 'Event end date and time (ISO 8601)', required: false, example: '2026-03-15T17:00:00Z' })
  endDate?: string;

  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status must be one of: draft, submitted, approved, rejected, cancelled, completed' })
  @ApiProperty({ 
    description: 'Event status', 
    enum: EventStatus, 
    default: EventStatus.DRAFT, 
    required: false 
  })
  status?: EventStatus;

  @IsOptional()
  @IsInt({ message: 'Max attendees must be an integer' })
  @Min(1, { message: 'Max attendees must be at least 1' })
  @ApiProperty({ description: 'Maximum number of attendees', required: false, example: 100 })
  maxAttendees?: number;

  @IsOptional()
  @IsBoolean({ message: 'isVirtual must be a boolean' })
  @ApiProperty({ description: 'Is the event virtual/online?', default: false, required: false })
  isVirtual?: boolean;

  @IsOptional()
  @ValidateIf((o) => o.isVirtual === true)
  @IsUrl({}, { message: 'Virtual URL must be a valid URL' })
  @MaxLength(500, { message: 'Virtual URL cannot exceed 500 characters' })
  @ApiProperty({ description: 'Virtual event URL (required if isVirtual is true)', required: false, example: 'https://zoom.us/j/123456789' })
  virtualUrl?: string;
}
