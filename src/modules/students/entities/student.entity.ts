import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

@Entity('students')
export class Student {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Student ID' })
  id!: string;

  @Column()
  @ApiProperty({ description: 'Student full name' })
  name!: string;

  @Column({ unique: true })
  @ApiProperty({ description: 'Student email' })
  email!: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Student phone number', required: false })
  phone?: string;

  @Column()
  @ApiProperty({ description: 'Student enrollment number' })
  enrollmentNumber!: string;

  @Column({ default: true })
  @ApiProperty({ description: 'Is student active?', default: true })
  isActive!: boolean;
  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}