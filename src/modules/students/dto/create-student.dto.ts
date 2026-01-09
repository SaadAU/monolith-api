import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(3, { message: 'Name must be at least 3 characters' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens and apostrophes',
  })
  @ApiProperty({
    description: 'Student full name',
    minLength: 3,
    maxLength: 100,
    example: 'John Doe',
  })
  name!: string;

  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  @ApiProperty({
    description: 'Student email',
    example: 'john.doe@example.com',
  })
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone number cannot exceed 20 characters' })
  @Matches(/^[\d\s+()-]*$/, {
    message: 'Phone can only contain digits, spaces, +, (), -',
  })
  @ApiProperty({
    description: 'Student phone number',
    required: false,
    example: '+1-555-123-4567',
  })
  phone?: string;

  @IsNotEmpty({ message: 'Enrollment number is required' })
  @IsString()
  @MinLength(3, { message: 'Enrollment number must be at least 3 characters' })
  @MaxLength(50, { message: 'Enrollment number cannot exceed 50 characters' })
  @ApiProperty({
    description: 'Student enrollment number',
    example: 'ENR-2025-001',
  })
  enrollmentNumber!: string;
}
