import { Controller, Logger } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  CreateEventRequestDto,
  ListEventsRequestDto,
  UpdateEventRequestDto,
  EventResponseDto,
  ListEventsResponseDto,
  ApproveEventRequestDto,
  RejectEventRequestDto,
} from '@shared';
import { EVENTS_SERVICE_PATTERNS } from '@shared';
import { EventsService } from '../services/events.service';

@Controller()
export class EventsController {
  private readonly logger = new Logger(EventsController.name);

  constructor(private readonly eventsService: EventsService) {}

  @MessagePattern(EVENTS_SERVICE_PATTERNS.CREATE_EVENT)
  async createEvent(
    @Payload() data: CreateEventRequestDto,
  ): Promise<EventResponseDto> {
    this.logger.log(`Create event: ${data.title}`);
    return this.eventsService.createEvent(data);
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.GET_EVENT)
  async getEvent(@Payload() data: { id: string }): Promise<EventResponseDto> {
    this.logger.log(`Get event: ${data.id}`);
    return this.eventsService.getEvent(data.id);
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.LIST_EVENTS)
  async listEvents(
    @Payload() data: ListEventsRequestDto,
  ): Promise<ListEventsResponseDto> {
    this.logger.log(`List events for org: ${data.orgId}`);
    return this.eventsService.listEvents(data);
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.UPDATE_EVENT)
  async updateEvent(
    @Payload() data: UpdateEventRequestDto,
  ): Promise<EventResponseDto> {
    this.logger.log(`Update event: ${data.id}`);
    return this.eventsService.updateEvent(data);
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.DELETE_EVENT)
  async deleteEvent(
    @Payload() data: { id: string; deletedById: string },
  ): Promise<{ message: string }> {
    this.logger.log(`Delete event: ${data.id}`);
    await this.eventsService.deleteEvent(data.id, data.deletedById);
    return { message: 'Event deleted successfully' };
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.APPROVE_EVENT)
  async approveEvent(
    @Payload() data: ApproveEventRequestDto,
  ): Promise<EventResponseDto> {
    this.logger.log(`Approve event: ${data.id}`);
    return this.eventsService.approveEvent(data.id);
  }

  @MessagePattern(EVENTS_SERVICE_PATTERNS.REJECT_EVENT)
  async rejectEvent(
    @Payload() data: RejectEventRequestDto,
  ): Promise<EventResponseDto> {
    this.logger.log(`Reject event: ${data.id}`);
    return this.eventsService.rejectEvent(data.id, data.rejectionReason);
  }
}
