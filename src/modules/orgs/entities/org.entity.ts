import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { User } from '../../users/entities/user.entity';

@Entity('orgs')
export class Org {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Organization ID' })
  id!: string;

  @Column({ length: 100 })
  @Index()
  @ApiProperty({ description: 'Organization name', maxLength: 100 })
  name!: string;

  @Column({ length: 50, unique: true })
  @Index({ unique: true })
  @ApiProperty({ description: 'URL-friendly slug', maxLength: 50 })
  slug!: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Organization description', required: false })
  description?: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Organization website URL', required: false })
  website?: string;

  @Column({ length: 20, nullable: true })
  @ApiProperty({ description: 'Organization phone number', required: false })
  phone?: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Organization address', required: false })
  address?: string;

  @Column({ default: true })
  @Index()
  @ApiProperty({ description: 'Is organization active?', default: true })
  isActive!: boolean;

  @OneToMany(() => User, (user) => user.org)
  users!: User[];

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
