import { ApiProperty } from '@nestjs/swagger';
import { UserRole } from '../../users/entities/user.entity';

export class UserResponseDto {
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @ApiProperty({ description: 'User full name' })
  name!: string;

  @ApiProperty({ description: 'User email address' })
  email!: string;

  @ApiProperty({ description: 'User phone number', required: false })
  phone?: string;

  @ApiProperty({ description: 'User role', enum: UserRole })
  role!: UserRole;

  @ApiProperty({ description: 'Organization ID' })
  orgId!: string;

  @ApiProperty({ description: 'Is user active?' })
  isActive!: boolean;

  @ApiProperty({ description: 'Last login timestamp', required: false })
  lastLoginAt?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Success message' })
  message!: string;

  @ApiProperty({ description: 'User details', type: UserResponseDto })
  user!: UserResponseDto;
}

export class LogoutResponseDto {
  @ApiProperty({ description: 'Success message' })
  message!: string;
}
