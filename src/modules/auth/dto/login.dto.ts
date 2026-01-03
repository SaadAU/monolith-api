import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Please provide a valid email address' })
  @MaxLength(255, { message: 'Email cannot exceed 255 characters' })
  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@acme.com',
  })
  email!: string;

  @IsNotEmpty({ message: 'Password is required' })
  @IsString()
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  @ApiProperty({
    description: 'User password',
    example: 'SecurePass123',
  })
  password!: string;

  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID('4', { message: 'Organization ID must be a valid UUID' })
  @ApiProperty({
    description: 'Organization ID the user belongs to',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  orgId!: string;
}
