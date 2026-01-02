import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Event, EventStatus } from '../entities/event.entity';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import { QueryEventsDto } from '../dto/query-events.dto';
import { EventResponseDto, EventListResponseDto } from '../dto/event-response.dto';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
  ) {}

  /**
   * Create a new event (org-scoped)
   * Automatically assigns the creator and organization
   */
  async create(
    createEventDto: CreateEventDto,
    userId: string,
    orgId: string,
  ): Promise<EventResponseDto> {
    // Validate date logic
    if (createEventDto.endDate && new Date(createEventDto.endDate) <= new Date(createEventDto.startDate)) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate virtual event has URL
    if (createEventDto.isVirtual && !createEventDto.virtualUrl) {
      throw new BadRequestException('Virtual events must have a virtual URL');
    }

    const event = this.eventsRepository.create({
      ...createEventDto,
      startDate: new Date(createEventDto.startDate),
      endDate: createEventDto.endDate ? new Date(createEventDto.endDate) : undefined,
      status: createEventDto.status || EventStatus.DRAFT,
      isVirtual: createEventDto.isVirtual || false,
      orgId,
      createdById: userId,
    });

    const savedEvent = await this.eventsRepository.save(event);
    
    // Reload with relations to return full data
    const eventWithRelations = await this.eventsRepository.findOne({
      where: { id: savedEvent.id },
      relations: ['createdBy'],
    });

    return this.toResponseDto(eventWithRelations!);
  }

  /**
   * Find all events for an organization (org-scoped)
   * Supports filtering, pagination, and sorting
   */
  async findAll(
    orgId: string,
    queryDto: QueryEventsDto,
  ): Promise<EventListResponseDto> {
    const { status, search, page = 1, limit = 10, sortBy = 'startDate', sortOrder = 'ASC' } = queryDto;

    // Build where clause with org scoping
    const where: FindOptionsWhere<Event> = { orgId };
    
    if (status) {
      where.status = status;
    }

    // Build query
    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.orgId = :orgId', { orgId });

    // Apply status filter
    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    // Apply search filter (title)
    if (search) {
      queryBuilder.andWhere('event.title ILIKE :search', { search: `%${search}%` });
    }

    // Apply sorting (whitelist allowed fields)
    const allowedSortFields = ['startDate', 'createdAt', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'startDate';
    queryBuilder.orderBy(`event.${safeSortBy}`, sortOrder);

    // Apply pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      data: events.map((event) => this.toResponseDto(event)),
      total,
      page,
      limit,
    };
  }

  /**
   * Find a single event by ID (org-scoped)
   * Returns 404 if not found or not in user's org
   */
  async findOne(id: string, orgId: string): Promise<EventResponseDto> {
    const event = await this.eventsRepository.findOne({
      where: { id, orgId }, // Org scoping enforced
      relations: ['createdBy'],
    });

    if (!event) {
      throw new NotFoundException(`Event with ID '${id}' not found`);
    }

    return this.toResponseDto(event);
  }

  /**
   * Find raw event entity (for internal use / guards)
   */
  async findOneEntity(id: string, orgId: string): Promise<Event> {
    const event = await this.eventsRepository.findOne({
      where: { id, orgId },
    });

    if (!event) {
      throw new NotFoundException(`Event with ID '${id}' not found`);
    }

    return event;
  }

  /**
   * Update an event (ownership required)
   * Only the creator can update their event
   */
  async update(
    id: string,
    updateEventDto: UpdateEventDto,
    userId: string,
    orgId: string,
  ): Promise<EventResponseDto> {
    const event = await this.findOneEntity(id, orgId);

    // Ownership check
    if (event.createdById !== userId) {
      throw new ForbiddenException('You can only edit events you created');
    }

    // Validate date logic if both dates are being set
    const newStartDate = updateEventDto.startDate 
      ? new Date(updateEventDto.startDate) 
      : event.startDate;
    const newEndDate = updateEventDto.endDate 
      ? new Date(updateEventDto.endDate) 
      : event.endDate;

    if (newEndDate && newEndDate <= newStartDate) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate virtual event URL
    const willBeVirtual = updateEventDto.isVirtual ?? event.isVirtual;
    const willHaveUrl = updateEventDto.virtualUrl ?? event.virtualUrl;
    
    if (willBeVirtual && !willHaveUrl) {
      throw new BadRequestException('Virtual events must have a virtual URL');
    }

    // Apply updates
    Object.assign(event, {
      ...updateEventDto,
      startDate: updateEventDto.startDate ? new Date(updateEventDto.startDate) : event.startDate,
      endDate: updateEventDto.endDate ? new Date(updateEventDto.endDate) : event.endDate,
    });

    const updatedEvent = await this.eventsRepository.save(event);

    // Reload with relations
    const eventWithRelations = await this.eventsRepository.findOne({
      where: { id: updatedEvent.id },
      relations: ['createdBy'],
    });

    return this.toResponseDto(eventWithRelations!);
  }

  /**
   * Delete an event (ownership required)
   * Only the creator can delete their event
   */
  async remove(id: string, userId: string, orgId: string): Promise<void> {
    const event = await this.findOneEntity(id, orgId);

    // Ownership check
    if (event.createdById !== userId) {
      throw new ForbiddenException('You can only delete events you created');
    }

    await this.eventsRepository.remove(event);
  }

  /**
   * Check if user owns the event
   * Used by ownership guard
   */
  async isOwner(eventId: string, userId: string, orgId: string): Promise<boolean> {
    const event = await this.eventsRepository.findOne({
      where: { id: eventId, orgId },
      select: ['id', 'createdById'],
    });

    if (!event) {
      return false;
    }

    return event.createdById === userId;
  }

  /**
   * Find events created by a specific user (within their org)
   */
  async findByCreator(
    userId: string,
    orgId: string,
    queryDto: QueryEventsDto,
  ): Promise<EventListResponseDto> {
    const { status, page = 1, limit = 10, sortBy = 'startDate', sortOrder = 'ASC' } = queryDto;

    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.orgId = :orgId', { orgId })
      .andWhere('event.createdById = :userId', { userId });

    if (status) {
      queryBuilder.andWhere('event.status = :status', { status });
    }

    const allowedSortFields = ['startDate', 'createdAt', 'title'];
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'startDate';
    queryBuilder.orderBy(`event.${safeSortBy}`, sortOrder);

    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [events, total] = await queryBuilder.getManyAndCount();

    return {
      data: events.map((event) => this.toResponseDto(event)),
      total,
      page,
      limit,
    };
  }

  /**
   * Map Event entity to EventResponseDto
   * Ensures internal fields are not leaked
   */
  private toResponseDto(event: Event): EventResponseDto {
    return plainToInstance(EventResponseDto, event, {
      excludeExtraneousValues: true,
    });
  }
}
