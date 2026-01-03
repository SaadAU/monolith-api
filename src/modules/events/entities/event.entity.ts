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
import { User } from '../../users/entities/user.entity';

/**
 * Event status for lifecycle management
 * - DRAFT: Event is being created/edited, not visible to public
 * - PUBLISHED: Event is live and visible
 * - CANCELLED: Event was cancelled
 * - COMPLETED: Event has finished
 */
export enum EventStatus {
  DRAFT = 'draft',
  PUBLISHED = 'published',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

@Entity('events')
@Index(['orgId', 'status']) // Common query pattern: events by org and status
@Index(['orgId', 'startDate']) // Common query pattern: events by org and date
export class Event {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @Column({ length: 200 })
  @Index()
  @ApiProperty({ description: 'Event title', maxLength: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Event description', required: false })
  description?: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Event location/venue', required: false })
  location?: string;

  @Column({ type: 'timestamp' })
  @Index()
  @ApiProperty({ description: 'Event start date and time' })
  startDate!: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'Event end date and time', required: false })
  endDate?: Date;

  @Column({
    type: 'enum',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  @Index()
  @ApiProperty({ description: 'Event status', enum: EventStatus, default: EventStatus.DRAFT })
  status!: EventStatus;

  @Column({ type: 'int', nullable: true })
  @ApiProperty({ description: 'Maximum number of attendees', required: false })
  maxAttendees?: number;

  @Column({ type: 'boolean', default: false })
  @ApiProperty({ description: 'Is the event virtual/online?', default: false })
  isVirtual!: boolean;

  @Column({ length: 500, nullable: true })
  @ApiProperty({ description: 'Virtual event URL (if online)', required: false })
  virtualUrl?: string;

  // Organization relationship (for multi-tenancy/org scoping)
  @Column({ type: 'uuid' })
  @Index()
  orgId!: string;

  @ManyToOne(() => Org, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orgId' })
  @ApiProperty({ description: 'Organization this event belongs to', type: () => Org })
  org!: Org;

  // Owner relationship (for ownership checks)
  @Column({ type: 'uuid' })
  @Index()
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  @ApiProperty({ description: 'User who created this event', type: () => User })
  createdBy!: User;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
