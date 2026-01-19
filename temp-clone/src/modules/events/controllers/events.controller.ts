import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiExtraModels,
} from '@nestjs/swagger';
import { EventsService } from '../services/events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventsDto,
  EventResponseDto,
  EventListResponseDto,
  EventListOffsetResponseDto,
  EventSortField,
  SortOrder,
  PaginationType,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards';
import { CurrentUser } from '../../auth/decorators';
import { User } from '../../users/entities/user.entity';
import { EventStatus } from '../entities/event.entity';

@Controller('events')
@ApiTags('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(EventListResponseDto, EventListOffsetResponseDto)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  /**
   * Create a new event
   * - Authenticated users can create events
   * - Event is automatically assigned to the user's organization
   * - User becomes the event owner (createdById)
   */
  @Post()
  @ApiOperation({ summary: 'Create a new event' })
  @ApiResponse({
    status: 201,
    description: 'Event created successfully',
    type: EventResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async create(
    @Body() createEventDto: CreateEventDto,
    @CurrentUser() user: User,
  ): Promise<EventResponseDto> {
    return this.eventsService.create(createEventDto, user.id, user.orgId);
  }

  /**
   * Get all events for the user's organization
   * - Events are filtered by the user's orgId (org-scoping)
   * - Supports cursor-based pagination (preferred) and offset-based pagination
   * - All filter and sort options are whitelisted and validated
   */
  @Get()
  @ApiOperation({
    summary: 'Get all events for your organization',
    description: `
List events with support for filtering, sorting, and pagination.

**Pagination Strategies:**
- **Cursor-based (default):** Best for feeds, infinite scroll. Uses \`cursor\` parameter.
- **Offset-based:** Best for admin tables. Uses \`page\` and \`limit\` parameters.

**Filtering:**
All filter options are whitelisted. Unknown parameters will be rejected.

**Sorting:**
Only indexed fields can be used for sorting to ensure performance.
    `,
  })
  @ApiResponse({
    status: 200,
    description: 'List of events with pagination metadata',
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/EventListResponseDto' },
        { $ref: '#/components/schemas/EventListOffsetResponseDto' },
      ],
    },
  })
  @ApiResponse({ status: 400, description: 'Invalid query parameters' })
  // Filter query params
  @ApiQuery({
    name: 'status',
    required: false,
    enum: EventStatus,
    description: 'Filter by event status',
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description:
      'Search by title (case-insensitive partial match, max 100 chars)',
  })
  @ApiQuery({
    name: 'startDateFrom',
    required: false,
    type: String,
    description: 'Filter events starting from this date (ISO 8601)',
    example: '2026-01-01T00:00:00Z',
  })
  @ApiQuery({
    name: 'startDateTo',
    required: false,
    type: String,
    description: 'Filter events starting before this date (ISO 8601)',
    example: '2026-12-31T23:59:59Z',
  })
  @ApiQuery({
    name: 'isVirtual',
    required: false,
    type: Boolean,
    description: 'Filter by virtual/in-person events',
  })
  @ApiQuery({
    name: 'createdById',
    required: false,
    type: String,
    description: 'Filter by creator user ID (UUID)',
  })
  // Sort query params
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: EventSortField,
    description: 'Field to sort by (whitelisted options only)',
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    enum: SortOrder,
    description: 'Sort order (ASC or DESC)',
  })
  // Pagination query params
  @ApiQuery({
    name: 'paginationType',
    required: false,
    enum: PaginationType,
    description: 'Pagination strategy: cursor (default, recommended) or offset',
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    type: String,
    description: 'Cursor for cursor-based pagination (from previous response)',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number for offset pagination (default: 1)',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page (default: 20, max: 100)',
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findAll(
    @Query() queryDto: QueryEventsDto,
    @CurrentUser() user: User,
  ): Promise<EventListResponseDto | EventListOffsetResponseDto> {
    return this.eventsService.findAll(user.orgId, queryDto);
  }

  /**
   * Get events created by the current user
   * - Filtered to only show the user's own events
   * - Supports same pagination/filtering as findAll
   */
  @Get('my-events')
  @ApiOperation({
    summary: 'Get events created by the current user',
    description: 'Returns only events where the current user is the creator.',
  })
  @ApiResponse({
    status: 200,
    description: "List of user's events",
    schema: {
      oneOf: [
        { $ref: '#/components/schemas/EventListResponseDto' },
        { $ref: '#/components/schemas/EventListOffsetResponseDto' },
      ],
    },
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findMyEvents(
    @Query() queryDto: QueryEventsDto,
    @CurrentUser() user: User,
  ): Promise<EventListResponseDto | EventListOffsetResponseDto> {
    return this.eventsService.findByCreator(user.id, user.orgId, queryDto);
  }

  /**
   * Get a single event by ID
   * - Must belong to the user's organization
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({
    status: 200,
    description: 'Event found',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<EventResponseDto> {
    return this.eventsService.findOne(id, user.orgId);
  }

  /**
   * Update an event
   * - Must be the event owner to update
   * - Must belong to the user's organization
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update event (owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Event updated successfully',
    type: EventResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Not the event owner' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateEventDto: UpdateEventDto,
    @CurrentUser() user: User,
  ): Promise<EventResponseDto> {
    return this.eventsService.update(id, updateEventDto, user.id, user.orgId);
  }

  /**
   * Delete an event
   * - Must be the event owner to delete
   * - Must belong to the user's organization
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete event (owner only)' })
  @ApiResponse({ status: 204, description: 'Event deleted successfully' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Not the event owner' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    return this.eventsService.remove(id, user.id, user.orgId);
  }
}
