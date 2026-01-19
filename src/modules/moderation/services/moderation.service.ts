import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '../../events/entities/event.entity';
import { ModerationResponseDto } from '../dto/moderation-response.dto';
import { User, UserRole } from '../../users/entities/user.entity';
import { DomainEventEmitter } from '../../../common/events';
import {
  EventSubmittedEvent,
  EventApprovedEvent,
  EventRejectedEvent,
  EventRevertedToDraftEvent,
} from '../events';

/**
 * Allowed state transitions for the moderation workflow.
 * This implements a finite state machine for event lifecycle.
 *
 * State Diagram:
 *
 *   DRAFT ──────► SUBMITTED ──────► APPROVED
 *     ▲               │
 *     │               ▼
 *     └────────── REJECTED
 */
const ALLOWED_TRANSITIONS: Record<EventStatus, EventStatus[]> = {
  [EventStatus.DRAFT]: [EventStatus.SUBMITTED],
  [EventStatus.SUBMITTED]: [EventStatus.APPROVED, EventStatus.REJECTED],
  [EventStatus.APPROVED]: [EventStatus.CANCELLED, EventStatus.COMPLETED],
  [EventStatus.REJECTED]: [EventStatus.DRAFT], // Allow re-editing after rejection
  [EventStatus.CANCELLED]: [],
  [EventStatus.COMPLETED]: [],
};

/**
 * Human-readable messages for each transition
 */
const TRANSITION_MESSAGES: Record<string, string> = {
  draft_submitted: 'Event submitted for moderation review',
  submitted_approved: 'Event approved and now visible to users',
  submitted_rejected:
    'Event rejected - please review the feedback and resubmit',
  rejected_draft: 'Event moved back to draft for editing',
  approved_cancelled: 'Event has been cancelled',
  approved_completed: 'Event marked as completed',
};

@Injectable()
export class ModerationService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    private readonly domainEventEmitter: DomainEventEmitter,
  ) {}

  /**
   * Check if a state transition is allowed
   */
  private canTransition(from: EventStatus, to: EventStatus): boolean {
    return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
  }

  /**
   * Get transition message key
   */
  private getTransitionKey(from: EventStatus, to: EventStatus): string {
    return `${from}_${to}`;
  }

  /**
   * Submit an event for moderation (owner only)
   * Transition: DRAFT → SUBMITTED
   */
  async submit(eventId: string, user: User): Promise<ModerationResponseDto> {
    const event = await this.findEventWithValidation(eventId, user.orgId);

    // Only owner can submit their own events
    if (event.createdById !== user.id) {
      throw new ForbiddenException('You can only submit events you created');
    }

    // Validate transition
    if (!this.canTransition(event.status, EventStatus.SUBMITTED)) {
      if (event.status === EventStatus.SUBMITTED) {
        throw new ConflictException('Event is already submitted for review');
      }
      throw new BadRequestException(
        `Cannot submit event: Event must be in DRAFT status (current: ${event.status})`,
      );
    }

    const previousStatus = event.status;

    // Apply transition
    event.status = EventStatus.SUBMITTED;
    event.submittedAt = new Date();
    // Clear any previous rejection data
    event.rejectionReason = undefined;
    event.rejectedAt = undefined;

    await this.eventsRepository.save(event);

    // Emit domain event
    this.domainEventEmitter.emit(
      new EventSubmittedEvent(event.id, user.id, user.orgId, event.title),
    );

    return this.toModerationResponse(event, previousStatus, 'submit');
  }

  /**
   * Approve a submitted event (moderator/admin only)
   * Transition: SUBMITTED → APPROVED
   */
  async approve(
    eventId: string,
    moderator: User,
  ): Promise<ModerationResponseDto> {
    // Only moderators and admins can approve
    this.validateModeratorRole(moderator);

    const event = await this.findEventWithValidation(eventId, moderator.orgId);

    // Validate transition
    if (!this.canTransition(event.status, EventStatus.APPROVED)) {
      if (event.status === EventStatus.APPROVED) {
        throw new ConflictException('Event is already approved');
      }
      if (event.status === EventStatus.DRAFT) {
        throw new BadRequestException(
          'Cannot approve event: Event must be submitted for review first',
        );
      }
      throw new BadRequestException(
        `Cannot approve event: Invalid status transition from ${event.status}`,
      );
    }

    const previousStatus = event.status;

    // Apply transition
    event.status = EventStatus.APPROVED;
    event.approvedAt = new Date();
    event.moderatedById = moderator.id;
    // Clear rejection data if re-approved
    event.rejectionReason = undefined;
    event.rejectedAt = undefined;

    await this.eventsRepository.save(event);

    // Reload with moderator relation
    const updatedEvent = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['moderatedBy', 'createdBy'],
    });

    // Emit domain event
    this.domainEventEmitter.emit(
      new EventApprovedEvent(
        eventId,
        updatedEvent!.createdById,
        moderator.orgId,
        moderator.id,
        updatedEvent!.title,
      ),
    );

    return this.toModerationResponse(updatedEvent!, previousStatus, 'approve');
  }

  /**
   * Reject a submitted event (moderator/admin only)
   * Transition: SUBMITTED → REJECTED
   */
  async reject(
    eventId: string,
    moderator: User,
    reason: string,
  ): Promise<ModerationResponseDto> {
    // Only moderators and admins can reject
    this.validateModeratorRole(moderator);

    const event = await this.findEventWithValidation(eventId, moderator.orgId);

    // Validate transition
    if (!this.canTransition(event.status, EventStatus.REJECTED)) {
      if (event.status === EventStatus.REJECTED) {
        throw new ConflictException('Event is already rejected');
      }
      if (event.status === EventStatus.DRAFT) {
        throw new BadRequestException(
          'Cannot reject event: Event must be submitted for review first',
        );
      }
      if (event.status === EventStatus.APPROVED) {
        throw new BadRequestException(
          'Cannot reject event: Event is already approved',
        );
      }
      throw new BadRequestException(
        `Cannot reject event: Invalid status transition from ${event.status}`,
      );
    }

    const previousStatus = event.status;

    // Apply transition
    event.status = EventStatus.REJECTED;
    event.rejectedAt = new Date();
    event.rejectionReason = reason;
    event.moderatedById = moderator.id;
    // Clear approval data
    event.approvedAt = undefined;

    await this.eventsRepository.save(event);

    // Reload with moderator relation
    const updatedEvent = await this.eventsRepository.findOne({
      where: { id: eventId },
      relations: ['moderatedBy', 'createdBy'],
    });

    // Emit domain event
    this.domainEventEmitter.emit(
      new EventRejectedEvent(
        eventId,
        updatedEvent!.createdById,
        moderator.orgId,
        moderator.id,
        updatedEvent!.title,
        reason,
      ),
    );

    return this.toModerationResponse(updatedEvent!, previousStatus, 'reject');
  }

  /**
   * Revert a rejected event back to draft (owner only)
   * Transition: REJECTED → DRAFT
   */
  async revertToDraft(
    eventId: string,
    user: User,
  ): Promise<ModerationResponseDto> {
    const event = await this.findEventWithValidation(eventId, user.orgId);

    // Only owner can revert their own events
    if (event.createdById !== user.id) {
      throw new ForbiddenException('You can only edit events you created');
    }

    // Validate transition
    if (!this.canTransition(event.status, EventStatus.DRAFT)) {
      throw new BadRequestException(
        `Cannot revert to draft: Event must be in REJECTED status (current: ${event.status})`,
      );
    }

    const previousStatus = event.status;

    // Apply transition
    event.status = EventStatus.DRAFT;

    await this.eventsRepository.save(event);

    // Emit domain event
    this.domainEventEmitter.emit(
      new EventRevertedToDraftEvent(
        eventId,
        user.id,
        user.orgId,
        event.title,
        previousStatus,
      ),
    );

    return this.toModerationResponse(event, previousStatus, 'revert-to-draft');
  }

  /**
   * Get all events pending moderation (moderator/admin only)
   */
  async getPendingEvents(
    moderator: User,
    page = 1,
    limit = 10,
  ): Promise<{
    data: ModerationResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    this.validateModeratorRole(moderator);

    const [events, total] = await this.eventsRepository.findAndCount({
      where: {
        orgId: moderator.orgId,
        status: EventStatus.SUBMITTED,
      },
      relations: ['createdBy'],
      order: { submittedAt: 'ASC' }, // Oldest first (FIFO queue)
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      data: events.map((event) =>
        this.toModerationResponse(event, event.status, 'pending'),
      ),
      total,
      page,
      limit,
    };
  }

  /**
   * Get moderation history for an event
   */
  async getEventModerationStatus(
    eventId: string,
    orgId: string,
  ): Promise<ModerationResponseDto> {
    const event = await this.findEventWithValidation(eventId, orgId);
    return this.toModerationResponse(event, event.status, 'status');
  }

  /**
   * Find event with org validation
   */
  private async findEventWithValidation(
    eventId: string,
    orgId: string,
  ): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId, orgId },
      relations: ['moderatedBy', 'createdBy'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID '${eventId}' not found`);
    }

    return event;
  }

  /**
   * Validate that user has moderator or admin role
   */
  private validateModeratorRole(user: User): void {
    if (user.role !== UserRole.MODERATOR && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'Only moderators and admins can perform this action',
      );
    }
  }

  /**
   * Convert event to moderation response DTO
   */
  private toModerationResponse(
    event: Event,
    previousStatus: EventStatus,
    action: string,
  ): ModerationResponseDto {
    const transitionKey = this.getTransitionKey(previousStatus, event.status);
    const message =
      TRANSITION_MESSAGES[transitionKey] || `Event status: ${event.status}`;

    return {
      id: event.id,
      title: event.title,
      status: event.status,
      previousStatus,
      rejectionReason: event.rejectionReason,
      submittedAt: event.submittedAt,
      approvedAt: event.approvedAt,
      rejectedAt: event.rejectedAt,
      moderatedBy: event.moderatedBy
        ? { id: event.moderatedBy.id, name: event.moderatedBy.name }
        : undefined,
      action,
      message,
    };
  }
}
