import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  EventSubmittedEvent,
  EventApprovedEvent,
  EventRejectedEvent,
  EventRevertedToDraftEvent,
} from '../events';

/**
 * Example listener for moderation events
 * This demonstrates how other modules can react to moderation events
 * without directly depending on the moderation module
 *
 * In a real application, this could:
 * - Send notifications to users
 * - Update analytics
 * - Trigger workflows
 * - Send emails
 * - Update search indexes
 */
@Injectable()
export class ModerationEventListener {
  private readonly logger = new Logger(ModerationEventListener.name);

  @OnEvent('event.submitted')
  handleEventSubmitted(event: EventSubmittedEvent) {
    this.logger.log(
      `Event submitted for moderation: ${event.eventTitle} (${event.aggregateId}) by user ${event.userId}`,
    );
    // Here you could:
    // - Notify moderators
    // - Update statistics
    // - Trigger analytics
  }

  @OnEvent('event.approved')
  handleEventApproved(event: EventApprovedEvent) {
    this.logger.log(
      `Event approved: ${event.eventTitle} (${event.aggregateId}) by moderator ${event.moderatorId}`,
    );
    // Here you could:
    // - Notify event owner
    // - Publish to public calendars
    // - Update search index
  }

  @OnEvent('event.rejected')
  handleEventRejected(event: EventRejectedEvent) {
    this.logger.log(
      `Event rejected: ${event.eventTitle} (${event.aggregateId}) by moderator ${event.moderatorId}`,
    );
    if (event.reason) {
      this.logger.log(`Rejection reason: ${event.reason}`);
    }
    // Here you could:
    // - Notify event owner with rejection reason
    // - Track rejection metrics
  }

  @OnEvent('event.reverted_to_draft')
  handleEventRevertedToDraft(event: EventRevertedToDraftEvent) {
    this.logger.log(
      `Event reverted to draft: ${event.eventTitle} (${event.aggregateId}) from status ${event.previousStatus}`,
    );
    // Here you could:
    // - Notify user
    // - Remove from public listings
  }
}
