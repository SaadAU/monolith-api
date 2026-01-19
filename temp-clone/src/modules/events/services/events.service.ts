import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { plainToInstance } from 'class-transformer';
import { Event, EventStatus } from '../entities/event.entity';
import { CreateEventDto } from '../dto/create-event.dto';
import { UpdateEventDto } from '../dto/update-event.dto';
import {
  QueryEventsDto,
  EventSortField,
  SortOrder,
  PaginationType,
  DecodedCursor,
} from '../dto/query-events.dto';
import {
  EventResponseDto,
  EventListResponseDto,
  EventListOffsetResponseDto,
  CursorPaginationMeta,
  OffsetPaginationMeta,
} from '../dto/event-response.dto';

/**
 * Events Service
 *
 * Provides CRUD operations for events with:
 * - Organization scoping (multi-tenancy)
 * - Ownership-based access control
 * - Cursor-based and offset-based pagination
 * - Whitelisted filtering and sorting
 */
@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(Event)
    private eventsRepository: Repository<Event>,
  ) {}

  // ============================================
  // CURSOR UTILITIES
  // ============================================

  /**
   * Encode cursor for pagination
   * Uses base64 to encode a JSON object containing:
   * - id: The event's UUID for uniqueness
   * - sortValue: The value of the sort field for comparison
   * - sortField: Which field we're sorting by
   */
  private encodeCursor(event: Event, sortField: EventSortField): string {
    const sortValue = this.getSortValue(event, sortField);
    const cursorData: DecodedCursor = {
      id: event.id,
      sortValue:
        sortValue instanceof Date ? sortValue.toISOString() : sortValue,
      sortField,
    };
    return Buffer.from(JSON.stringify(cursorData)).toString('base64');
  }

  /**
   * Decode cursor from pagination request
   * Validates and parses the base64-encoded cursor
   */
  private decodeCursor(cursor: string): DecodedCursor | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const parsed = JSON.parse(decoded) as DecodedCursor;

      // Validate cursor structure
      if (!parsed.id || !parsed.sortField || parsed.sortValue === undefined) {
        return null;
      }

      // Validate sortField is whitelisted
      if (!Object.values(EventSortField).includes(parsed.sortField)) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Get the value of a sort field from an event
   */
  private getSortValue(event: Event, sortField: EventSortField): string | Date {
    switch (sortField) {
      case EventSortField.START_DATE:
        return event.startDate;
      case EventSortField.CREATED_AT:
        return event.createdAt;
      case EventSortField.UPDATED_AT:
        return event.updatedAt;
      case EventSortField.TITLE:
        return event.title;
      case EventSortField.STATUS:
        return event.status;
      default:
        return event.startDate;
    }
  }

  // ============================================
  // QUERY BUILDER HELPERS
  // ============================================

  /**
   * Apply common filters to a query builder
   * All filters are whitelisted and validated via DTO
   */
  private applyFilters(
    queryBuilder: SelectQueryBuilder<Event>,
    queryDto: QueryEventsDto,
    orgId: string,
  ): void {
    // Always scope to organization (multi-tenancy)
    queryBuilder.where('event.orgId = :orgId', { orgId });

    // Status filter (validated enum via DTO)
    if (queryDto.status) {
      queryBuilder.andWhere('event.status = :status', {
        status: queryDto.status,
      });
    }

    // Search filter (sanitized via DTO, limited length)
    if (queryDto.search) {
      queryBuilder.andWhere('event.title ILIKE :search', {
        search: `%${queryDto.search}%`,
      });
    }

    // Date range filters (validated ISO dates via DTO)
    if (queryDto.startDateFrom) {
      queryBuilder.andWhere('event.startDate >= :startDateFrom', {
        startDateFrom: new Date(queryDto.startDateFrom),
      });
    }

    if (queryDto.startDateTo) {
      queryBuilder.andWhere('event.startDate <= :startDateTo', {
        startDateTo: new Date(queryDto.startDateTo),
      });
    }

    // Virtual event filter (validated boolean via DTO)
    if (queryDto.isVirtual !== undefined) {
      queryBuilder.andWhere('event.isVirtual = :isVirtual', {
        isVirtual: queryDto.isVirtual,
      });
    }

    // Creator filter (validated UUID via DTO)
    if (queryDto.createdById) {
      queryBuilder.andWhere('event.createdById = :createdById', {
        createdById: queryDto.createdById,
      });
    }
  }

  /**
   * Apply cursor-based pagination to query
   * Uses keyset pagination for consistent results
   */
  private applyCursorPagination(
    queryBuilder: SelectQueryBuilder<Event>,
    cursor: DecodedCursor,
    sortOrder: SortOrder,
  ): void {
    const comparison = sortOrder === SortOrder.ASC ? '>' : '<';
    const sortField = cursor.sortField;

    // Map sort field to database column
    const columnMap: Record<EventSortField, string> = {
      [EventSortField.START_DATE]: 'event.startDate',
      [EventSortField.CREATED_AT]: 'event.createdAt',
      [EventSortField.UPDATED_AT]: 'event.updatedAt',
      [EventSortField.TITLE]: 'event.title',
      [EventSortField.STATUS]: 'event.status',
    };

    const column = columnMap[sortField];

    // Keyset pagination: (sortValue, id) > (cursorSortValue, cursorId)
    // This handles ties in the sort field by using ID as tiebreaker
    queryBuilder.andWhere(
      `(${column} ${comparison} :cursorValue OR (${column} = :cursorValue AND event.id ${comparison} :cursorId))`,
      {
        cursorValue: cursor.sortValue,
        cursorId: cursor.id,
      },
    );
  }

  // ============================================
  // CRUD OPERATIONS
  // ============================================

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
    if (
      createEventDto.endDate &&
      new Date(createEventDto.endDate) <= new Date(createEventDto.startDate)
    ) {
      throw new BadRequestException('End date must be after start date');
    }

    // Validate virtual event has URL
    if (createEventDto.isVirtual && !createEventDto.virtualUrl) {
      throw new BadRequestException('Virtual events must have a virtual URL');
    }

    const event = this.eventsRepository.create({
      ...createEventDto,
      startDate: new Date(createEventDto.startDate),
      endDate: createEventDto.endDate
        ? new Date(createEventDto.endDate)
        : undefined,
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
   * Supports filtering, cursor/offset pagination, and sorting
   *
   * Pagination Strategy:
   * - Cursor-based (default): Better for feeds, infinite scroll, real-time data
   * - Offset-based: Better for admin tables with page numbers
   */
  async findAll(
    orgId: string,
    queryDto: QueryEventsDto,
  ): Promise<EventListResponseDto | EventListOffsetResponseDto> {
    const {
      sortBy = EventSortField.START_DATE,
      sortOrder = SortOrder.ASC,
      paginationType = PaginationType.CURSOR,
      cursor,
      page = 1,
      limit = 20,
    } = queryDto;

    // Build base query with joins
    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.createdBy', 'createdBy');

    // Apply filters (all whitelisted via DTO validation)
    this.applyFilters(queryBuilder, queryDto, orgId);

    // Apply sorting (whitelist enforced via enum)
    // Always add ID as secondary sort for stable ordering
    queryBuilder
      .orderBy(`event.${sortBy}`, sortOrder)
      .addOrderBy('event.id', sortOrder);

    // Branch based on pagination type
    if (paginationType === PaginationType.CURSOR || cursor) {
      return this.findAllWithCursor(
        queryBuilder,
        queryDto,
        sortBy,
        sortOrder,
        cursor,
        limit,
      );
    } else {
      return this.findAllWithOffset(queryBuilder, page, limit);
    }
  }

  /**
   * Cursor-based pagination implementation
   * - O(1) performance regardless of offset
   * - Consistent results even when data changes
   * - Ideal for feeds and infinite scroll
   */
  private async findAllWithCursor(
    queryBuilder: SelectQueryBuilder<Event>,
    _queryDto: QueryEventsDto,
    sortBy: EventSortField,
    sortOrder: SortOrder,
    cursor: string | undefined,
    limit: number,
  ): Promise<EventListResponseDto> {
    // Apply cursor if provided
    if (cursor) {
      const decodedCursor = this.decodeCursor(cursor);
      if (!decodedCursor) {
        throw new BadRequestException('Invalid cursor format');
      }

      // Validate cursor sort field matches current query
      if (decodedCursor.sortField !== sortBy) {
        throw new BadRequestException(
          `Cursor was created with sortBy=${decodedCursor.sortField}, but query uses sortBy=${sortBy}. ` +
            `Cursors are not portable across different sort configurations.`,
        );
      }

      this.applyCursorPagination(queryBuilder, decodedCursor, sortOrder);
    }

    // Fetch one extra item to determine if there are more pages
    queryBuilder.take(limit + 1);

    const events = await queryBuilder.getMany();

    // Determine if there's a next page
    const hasNextPage = events.length > limit;
    if (hasNextPage) {
      events.pop(); // Remove the extra item
    }

    // Build cursors
    const lastEvent = events[events.length - 1];
    const firstEvent = events[0];

    const pagination: CursorPaginationMeta = {
      nextCursor:
        hasNextPage && lastEvent ? this.encodeCursor(lastEvent, sortBy) : null,
      prevCursor:
        cursor && firstEvent ? this.encodeCursor(firstEvent, sortBy) : null,
      hasNextPage,
      hasPrevPage: !!cursor,
      count: events.length,
    };

    return {
      data: events.map((event) => this.toResponseDto(event)),
      pagination,
    };
  }

  /**
   * Offset-based pagination implementation
   * - Familiar page/limit interface
   * - Includes total count for UI pagination
   * - Better for admin tables with page navigation
   */
  private async findAllWithOffset(
    queryBuilder: SelectQueryBuilder<Event>,
    page: number,
    limit: number,
  ): Promise<EventListOffsetResponseDto> {
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    const [events, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    const pagination: OffsetPaginationMeta = {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };

    return {
      data: events.map((event) => this.toResponseDto(event)),
      pagination,
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
      startDate: updateEventDto.startDate
        ? new Date(updateEventDto.startDate)
        : event.startDate,
      endDate: updateEventDto.endDate
        ? new Date(updateEventDto.endDate)
        : event.endDate,
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
  async isOwner(
    eventId: string,
    userId: string,
    orgId: string,
  ): Promise<boolean> {
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
   * Uses the same pagination strategy as findAll
   */
  async findByCreator(
    userId: string,
    orgId: string,
    queryDto: QueryEventsDto,
  ): Promise<EventListResponseDto | EventListOffsetResponseDto> {
    const {
      sortBy = EventSortField.START_DATE,
      sortOrder = SortOrder.ASC,
      paginationType = PaginationType.CURSOR,
      cursor,
      page = 1,
      limit = 20,
    } = queryDto;

    // Build base query with joins
    const queryBuilder = this.eventsRepository
      .createQueryBuilder('event')
      .leftJoinAndSelect('event.createdBy', 'createdBy')
      .where('event.orgId = :orgId', { orgId })
      .andWhere('event.createdById = :userId', { userId });

    // Apply additional filters
    if (queryDto.status) {
      queryBuilder.andWhere('event.status = :status', {
        status: queryDto.status,
      });
    }

    if (queryDto.search) {
      queryBuilder.andWhere('event.title ILIKE :search', {
        search: `%${queryDto.search}%`,
      });
    }

    // Apply sorting
    queryBuilder
      .orderBy(`event.${sortBy}`, sortOrder)
      .addOrderBy('event.id', sortOrder);

    // Branch based on pagination type
    if (paginationType === PaginationType.CURSOR || cursor) {
      return this.findAllWithCursor(
        queryBuilder,
        queryDto,
        sortBy,
        sortOrder,
        cursor,
        limit,
      );
    } else {
      return this.findAllWithOffset(queryBuilder, page, limit);
    }
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
