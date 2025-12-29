import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrgDto {
  @IsNotEmpty({ message: 'Organization name is required' })
  @IsString()
  @MaxLength(100, { message: 'Name cannot exceed 100 characters' })
  @ApiProperty({ description: 'Organization name', maxLength: 100, example: 'Acme Corporation' })
  name!: string;

  @IsNotEmpty({ message: 'Slug is required' })
  @IsString()
  @MaxLength(50, { message: 'Slug cannot exceed 50 characters' })
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug can only contain lowercase letters, numbers, and hyphens' })
  @ApiProperty({ description: 'URL-friendly slug', maxLength: 50, example: 'acme-corp' })
  slug!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Description cannot exceed 500 characters' })
  @ApiProperty({ description: 'Organization description', required: false, example: 'Leading tech company' })
  description?: string;

  @IsOptional()
  @IsUrl({}, { message: 'Please provide a valid URL' })
  @MaxLength(255, { message: 'Website URL cannot exceed 255 characters' })
  @ApiProperty({ description: 'Organization website', required: false, example: 'https://acme.com' })
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20, { message: 'Phone cannot exceed 20 characters' })
  @Matches(/^[\d\s+()-]*$/, { message: 'Phone can only contain digits, spaces, +, (), -' })
  @ApiProperty({ description: 'Organization phone', required: false, example: '+1-555-123-4567' })
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Address cannot exceed 255 characters' })
  @ApiProperty({ description: 'Organization address', required: false, example: '123 Main St, City' })
  address?: string;
}
