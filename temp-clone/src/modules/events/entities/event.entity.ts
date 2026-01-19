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
 * - SUBMITTED: Event submitted for moderation review
 * - APPROVED: Event approved by moderator, visible to public
 * - REJECTED: Event rejected by moderator, needs revision
 * - CANCELLED: Event was cancelled
 * - COMPLETED: Event has finished
 */
export enum EventStatus {
  DRAFT = 'draft',
  SUBMITTED = 'submitted',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

/**
 * Event Entity
 *
 * INDEX STRATEGY (Day 9):
 * ========================
 *
 * 1. idx_events_org_status (orgId, status)
 *    - Primary filter pattern: List events for an org filtered by status
 *    - Used by: GET /events?status=approved, moderation queues
 *    - Composite index enables efficient org-scoped status filtering
 *
 * 2. idx_events_org_startdate (orgId, startDate)
 *    - Calendar/timeline queries: Events sorted by date within an org
 *    - Used by: GET /events?sortBy=startDate, calendar views
 *    - Enables efficient range queries: events between dates
 *
 * 3. idx_events_org_createdat (orgId, createdAt)
 *    - Recently created events within an org
 *    - Used by: GET /events?sortBy=createdAt, "new events" feed
 *    - Enables cursor-based pagination on createdAt
 *
 * 4. idx_events_title (title)
 *    - Text search on event titles
 *    - Used by: GET /events?search=hackathon
 *    - B-tree index supports LIKE 'prefix%' efficiently
 *    - Note: For ILIKE '%term%', consider GIN/trigram index in production
 *
 * 5. idx_events_status (status)
 *    - Global status filtering (admin/moderation views)
 *    - Used by: Moderation queue across all orgs
 *
 * 6. idx_events_orgid (orgId)
 *    - Foreign key index for join performance
 *    - Used by: All org-scoped queries
 *
 * 7. idx_events_createdbyid (createdById)
 *    - "My events" queries - events by creator
 *    - Used by: GET /events/my-events, ownership checks
 *
 * 8. idx_events_startdate (startDate)
 *    - Global date queries (cross-org analytics, admin)
 *    - Used by: Date range filtering in admin dashboards
 *
 * 9. idx_events_org_status_startdate (orgId, status, startDate)
 *    - Most common query pattern: approved events sorted by date
 *    - Used by: Public event listings, calendar views with status filter
 *    - Covers WHERE orgId=? AND status=? ORDER BY startDate
 *
 * 10. idx_events_org_createdby (orgId, createdById)
 *     - "My events" within org context
 *     - Used by: GET /events/my-events with org scoping
 *     - Enables efficient ownership + org filtering
 *
 * 11. idx_events_isvirtual (isVirtual)
 *     - Filter by event type (virtual vs in-person)
 *     - Used by: GET /events?isVirtual=true
 *
 * PERFORMANCE NOTES:
 * - Composite indexes ordered by selectivity (most selective first)
 * - Avoid over-indexing: Each index adds write overhead
 * - Monitor slow queries and adjust indexes based on actual usage
 * - Consider partial indexes for hot paths (e.g., only APPROVED events)
 */
@Entity('events')
// Primary composite indexes for common query patterns
@Index('idx_events_org_status', ['orgId', 'status'])
@Index('idx_events_org_startdate', ['orgId', 'startDate'])
@Index('idx_events_org_createdat', ['orgId', 'createdAt'])
@Index('idx_events_org_status_startdate', ['orgId', 'status', 'startDate'])
@Index('idx_events_org_createdby', ['orgId', 'createdById'])
export class Event {
  @PrimaryGeneratedColumn('uuid')
  @ApiProperty({ description: 'Event ID' })
  id!: string;

  @Column({ length: 200 })
  @Index('idx_events_title')
  @ApiProperty({ description: 'Event title', maxLength: 200 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  @ApiProperty({ description: 'Event description', required: false })
  description?: string;

  @Column({ length: 255, nullable: true })
  @ApiProperty({ description: 'Event location/venue', required: false })
  location?: string;

  @Column({ type: 'timestamp' })
  @Index('idx_events_startdate')
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
  @Index('idx_events_status')
  @ApiProperty({
    description: 'Event status',
    enum: EventStatus,
    default: EventStatus.DRAFT,
  })
  status!: EventStatus;

  @Column({ type: 'int', nullable: true })
  @ApiProperty({ description: 'Maximum number of attendees', required: false })
  maxAttendees?: number;

  @Column({ type: 'boolean', default: false })
  @Index('idx_events_isvirtual')
  @ApiProperty({ description: 'Is the event virtual/online?', default: false })
  isVirtual!: boolean;

  @Column({ length: 500, nullable: true })
  @ApiProperty({
    description: 'Virtual event URL (if online)',
    required: false,
  })
  virtualUrl?: string;

  // Organization relationship (for multi-tenancy/org scoping)
  @Column({ type: 'uuid' })
  @Index('idx_events_orgid')
  orgId!: string;

  @ManyToOne(() => Org, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orgId' })
  @ApiProperty({
    description: 'Organization this event belongs to',
    type: () => Org,
  })
  org!: Org;

  // Owner relationship (for ownership checks)
  @Column({ type: 'uuid' })
  @Index('idx_events_createdbyid')
  createdById!: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'createdById' })
  @ApiProperty({ description: 'User who created this event', type: () => User })
  createdBy!: User;

  // Moderation audit fields
  @Column({ type: 'text', nullable: true })
  @ApiProperty({
    description: 'Reason for rejection (if rejected)',
    required: false,
  })
  rejectionReason?: string;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({
    description: 'When the event was submitted for review',
    required: false,
  })
  submittedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the event was approved', required: false })
  approvedAt?: Date;

  @Column({ type: 'timestamp', nullable: true })
  @ApiProperty({ description: 'When the event was rejected', required: false })
  rejectedAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  moderatedById?: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'moderatedById' })
  @ApiProperty({
    description: 'Moderator who approved/rejected the event',
    type: () => User,
    required: false,
  })
  moderatedBy?: User;

  @CreateDateColumn()
  @ApiProperty({ description: 'Creation timestamp' })
  createdAt!: Date;

  @UpdateDateColumn()
  @ApiProperty({ description: 'Last update timestamp' })
  updatedAt!: Date;
}
