import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

// Omit password and orgId from update (can't change org, password has separate endpoint)
export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['password', 'orgId'] as const),
) {}
