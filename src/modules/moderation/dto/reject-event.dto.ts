import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';

/**
 * DTO for rejecting an event
 * Requires a reason to be provided for transparency
 */
export class RejectEventDto {
  @ApiProperty({
    description: 'Reason for rejecting the event',
    example: 'Event description contains inappropriate content or violates community guidelines.',
    minLength: 10,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty({ message: 'Rejection reason is required' })
  @MinLength(10, { message: 'Rejection reason must be at least 10 characters' })
  @MaxLength(1000, { message: 'Rejection reason must not exceed 1000 characters' })
  reason!: string;
}
