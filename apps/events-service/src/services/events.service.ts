import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Event, EventStatus } from '@modules/events/entities/event.entity';
import { User } from '@modules/users/entities/user.entity';
import {
  CreateEventRequestDto,
  ListEventsRequestDto,
  UpdateEventRequestDto,
  EventResponseDto,
  ListEventsResponseDto,
} from '@shared';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async createEvent(
    createEventDto: CreateEventRequestDto,
  ): Promise<EventResponseDto> {
    try {
      const creator = await this.usersRepository.findOne({
        where: { id: createEventDto.createdById },
      });

      if (!creator) {
        throw new BadRequestException('Creator user not found');
      }

      const event = this.eventsRepository.create({
        title: createEventDto.title,
        description: createEventDto.description,
        startDate: createEventDto.startDate,
        endDate: createEventDto.endDate,
        location: createEventDto.location,
        maxAttendees: createEventDto.maxAttendees,
        isVirtual: createEventDto.isVirtual || false,
        virtualUrl: createEventDto.virtualUrl,
        status: EventStatus.DRAFT,
        orgId: createEventDto.orgId,
        createdById: createEventDto.createdById,
      });

      const savedEvent = await this.eventsRepository.save(event);
      this.logger.log(`Event created: ${savedEvent.id}`);

      // Reload event with relations to return full data
      const eventWithRelations = await this.eventsRepository.findOne({
        where: { id: savedEvent.id },
        relations: ['createdBy'],
      });

      return this.mapEventToDto(eventWithRelations!);
    } catch (error) {
      this.logger.error(
        'Create event error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Failed to create event');
    }
  }

  async getEvent(eventId: string): Promise<EventResponseDto> {
    try {
      const event = await this.eventsRepository.findOne({
        where: { id: eventId },
        relations: ['createdBy'],
      });

      if (!event) {
        throw new RpcException({ statusCode: 404, message: 'Event not found' });
      }

      return this.mapEventToDto(event);
    } catch (error) {
      this.logger.error(
        'Get event error:',
        error instanceof Error ? error.message : String(error),
      );
      if (error instanceof RpcException) {
        throw error;
      }
      throw new RpcException({
        statusCode: 400,
        message: 'Failed to fetch event',
      });
    }
  }

  async listEvents(
    listEventsDto: ListEventsRequestDto,
  ): Promise<ListEventsResponseDto> {
    try {
      const query = this.eventsRepository
        .createQueryBuilder('event')
        .where('event.orgId = :orgId', { orgId: listEventsDto.orgId })
        .leftJoinAndSelect('event.createdBy', 'createdBy');

      if (listEventsDto.status) {
        query.andWhere('event.status = :status', {
          status: listEventsDto.status,
        });
      }

      if (listEventsDto.search) {
        query.andWhere('event.title ILIKE :search', {
          search: `%${listEventsDto.search}%`,
        });
      }

      const skip = listEventsDto.skip || 0;
      const take = listEventsDto.take || 10;

      const [items, total] = await query
        .skip(skip)
        .take(take)
        .orderBy('event.createdAt', 'DESC')
        .getManyAndCount();

      return {
        items: items.map((event) => this.mapEventToDto(event)),
        total,
        skip,
        take,
      };
    } catch (error) {
      this.logger.error(
        'List events error:',
        error instanceof Error ? error.message : String(error),
      );
      throw new BadRequestException('Failed to list events');
    }
  }

  async updateEvent(
    updateEventDto: UpdateEventRequestDto,
  ): Promise<EventResponseDto> {
    try {
      const event = await this.eventsRepository.findOne({
        where: { id: updateEventDto.id },
        relations: ['createdBy'],
      });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      if (event.createdBy.id !== updateEventDto.updatedById) {
        throw new ForbiddenException('Only event creator can update the event');
      }

      if (updateEventDto.title) event.title = updateEventDto.title;
      if (updateEventDto.description)
        event.description = updateEventDto.description;
      if (updateEventDto.startDate) event.startDate = updateEventDto.startDate;
      if (updateEventDto.endDate) event.endDate = updateEventDto.endDate;
      if (updateEventDto.location) event.location = updateEventDto.location;
      if (updateEventDto.maxAttendees)
        event.maxAttendees = updateEventDto.maxAttendees;
      if (updateEventDto.isVirtual !== undefined)
        event.isVirtual = updateEventDto.isVirtual;
      if (updateEventDto.virtualUrl)
        event.virtualUrl = updateEventDto.virtualUrl;

      const updatedEvent = await this.eventsRepository.save(event);
      this.logger.log(`Event updated: ${updatedEvent.id}`);

      return this.mapEventToDto(updatedEvent);
    } catch (error) {
      this.logger.error(
        'Update event error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException ||
        error instanceof ForbiddenException
        ? error
        : new BadRequestException('Failed to update event');
    }
  }

  async deleteEvent(eventId: string, deletedById: string): Promise<void> {
    try {
      const event = await this.eventsRepository.findOne({
        where: { id: eventId },
        relations: ['createdBy'],
      });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      if (event.createdBy.id !== deletedById) {
        throw new ForbiddenException('Only event creator can delete the event');
      }

      await this.eventsRepository.remove(event);
      this.logger.log(`Event deleted: ${eventId}`);
    } catch (error) {
      this.logger.error(
        'Delete event error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException ||
        error instanceof ForbiddenException
        ? error
        : new BadRequestException('Failed to delete event');
    }
  }

  async approveEvent(eventId: string): Promise<EventResponseDto> {
    try {
      const event = await this.eventsRepository.findOne({
        where: { id: eventId },
        relations: ['createdBy'],
      });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      event.status = EventStatus.APPROVED;
      const updatedEvent = await this.eventsRepository.save(event);
      this.logger.log(`Event approved: ${eventId}`);

      return this.mapEventToDto(updatedEvent);
    } catch (error) {
      this.logger.error(
        'Approve event error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Failed to approve event');
    }
  }

  async rejectEvent(
    eventId: string,
    rejectionReason: string,
  ): Promise<EventResponseDto> {
    try {
      const event = await this.eventsRepository.findOne({
        where: { id: eventId },
        relations: ['createdBy'],
      });

      if (!event) {
        throw new BadRequestException('Event not found');
      }

      event.status = EventStatus.REJECTED;
      event.rejectionReason = rejectionReason;
      const updatedEvent = await this.eventsRepository.save(event);
      this.logger.log(`Event rejected: ${eventId}`);

      return this.mapEventToDto(updatedEvent);
    } catch (error) {
      this.logger.error(
        'Reject event error:',
        error instanceof Error ? error.message : String(error),
      );
      throw error instanceof BadRequestException
        ? error
        : new BadRequestException('Failed to reject event');
    }
  }

  private mapEventToDto(event: Event): EventResponseDto {
    return {
      id: event.id,
      title: event.title,
      description: event.description,
      startDate: event.startDate,
      endDate: event.endDate,
      location: event.location,
      maxAttendees: event.maxAttendees,
      isVirtual: event.isVirtual,
      virtualUrl: event.virtualUrl,
      status: event.status as
        | 'draft'
        | 'submitted'
        | 'approved'
        | 'rejected'
        | 'cancelled'
        | 'completed',
      rejectionReason: event.rejectionReason,
      orgId: event.orgId,
      createdBy: {
        id: event.createdBy.id,
        name: event.createdBy.name,
        email: event.createdBy.email,
      },
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
    };
  }
}
