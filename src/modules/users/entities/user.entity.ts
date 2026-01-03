import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';
import { Org } from '../../orgs/entities/org.entity';

/**
 * User roles for RBAC authorization
 * - ADMIN: Full access to all resources
 * - MODERATOR: Can manage content and moderate users
 * - USER: Standard user with basic access
 */
export enum UserRole {
  ADMIN = 'admin',
  MODERATOR = 'moderator',
  USER = 'user',
}

@Entity('users')
@Index(['orgId', 'email'], { unique: true }) // Unique email per org
export class User {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'User ID' })
  id!: string;

  @Column({ length: 100 })
  @Index()
  @ApiProperty({ description: 'User full name', maxLength: 100 })
  name!: string;

  @Column({ length: 255 })
  @Index()
  @ApiProperty({ description: 'User email address', maxLength: 255 })
  email!: string;

  @Column({ length: 255, select: false }) // Never return password in queries
  passwordHash!: string;

  @Column({ length: 20, nullable: true })
  @ApiProperty({ description: 'User phone number', required: false })
  phone?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.USER,
  })
  @Index()
  @ApiProperty({ description: 'User role', enum: UserRole, default: UserRole.USER })
  role!: UserRole;

  @Column({ type: 'uuid' })
  @Index()
  orgId!: string;

  @ManyToOne(() => Org, (org) => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orgId' })
  @ApiProperty({ description: 'Organization the user belongs to', type: () => Org })
  org!: Org;

  @Column({ default: true })
  @Index()
  @ApiProperty({ description: 'Is user active?', default: true })
  isActive!: boolean;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Last login timestamp', required: false })
  lastLoginAt?: Date;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
