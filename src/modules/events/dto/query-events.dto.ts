import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { EventStatus } from '../entities/event.entity';

/**
 * Query parameters for filtering and paginating events
 */
export class QueryEventsDto {
  @IsOptional()
  @IsEnum(EventStatus, { message: 'Status must be one of: draft, submitted, approved, rejected, cancelled, completed' })
  @ApiProperty({ 
    description: 'Filter by event status', 
    enum: EventStatus, 
    required: false 
  })
  status?: EventStatus;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Search by title (partial match)', required: false })
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @ApiProperty({ description: 'Page number', default: 1, required: false })
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @ApiProperty({ description: 'Items per page', default: 10, required: false })
  limit?: number = 10;

  @IsOptional()
  @IsString()
  @ApiProperty({ 
    description: 'Sort field', 
    enum: ['startDate', 'createdAt', 'title'], 
    default: 'startDate',
    required: false 
  })
  sortBy?: string = 'startDate';

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  @ApiProperty({ 
    description: 'Sort order', 
    enum: ['ASC', 'DESC'], 
    default: 'ASC',
    required: false 
  })
  sortOrder?: 'ASC' | 'DESC' = 'ASC';
}
