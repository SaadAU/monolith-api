import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class SignupDto {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString()
  @MinLength(2, { message: 'Name must be at least 2 characters' })
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @Matches(/^[a-zA-Z\s'-]+$/, {
    message: 'Name can only contain letters, spaces, hyphens and apostrophes',
  })
  @ApiProperty({
    description: 'User full name',
    minLength: 2,
    maxLength: 100,
    example: 'John Doe',
  })
  name!: string;

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
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  @MaxLength(100, { message: 'Password cannot exceed 100 characters' })
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, {
    message:
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
  })
  @ApiProperty({
    description: 'User password',
    minLength: 8,
    example: 'SecurePass123',
  })
  password!: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone cannot exceed 20 characters' })
  @Matches(/^[\d\s+()-]*$/, {
    message: 'Phone can only contain digits, spaces, +, (), -',
  })
  @ApiProperty({
    description: 'User phone number',
    required: false,
    example: '+1-555-123-4567',
  })
  phone?: string;

  @IsOptional()
  @IsEnum(UserRole, { message: 'Role must be one of: admin, organizer, member' })
  @ApiProperty({
    description: 'User role',
    enum: UserRole,
    default: UserRole.MEMBER,
    required: false,
  })
  role?: UserRole;

  @IsNotEmpty({ message: 'Organization ID is required' })
  @IsUUID(undefined, { message: 'Organization ID must be a valid UUID' })
  @ApiProperty({
    description: 'Organization ID the user belongs to',
    example: '22222222-2222-4222-a222-222222222222',
  })
  orgId!: string;
}
