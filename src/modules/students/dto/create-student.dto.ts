import { IsEmail, IsNotEmpty, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateStudentDto {
  @IsNotEmpty()
  @IsString()
  @MinLength(3)
  @ApiProperty({ description: 'Student full name', minLength: 3 })
  name!: string;

  @IsNotEmpty()
  @IsEmail()
  @ApiProperty({ description: 'Student email' })
  email!: string;

  @IsOptional()
  @IsString()
  @ApiProperty({ description: 'Student phone number', required: false })
  phone?: string;

  @IsNotEmpty()
  @IsString()
  @ApiProperty({ description: 'Student enrollment number' })
  enrollmentNumber!: string;
}