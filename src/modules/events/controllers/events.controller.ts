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
} from '@nestjs/swagger';
import { EventsService } from '../services/events.service';
import {
  CreateEventDto,
  UpdateEventDto,
  QueryEventsDto,
  EventResponseDto,
  EventListResponseDto,
} from '../dto';
import { JwtAuthGuard } from '../../auth/guards';
import { CurrentUser } from '../../auth/decorators';
import { User } from '../../users/entities/user.entity';
import { EventStatus } from '../entities/event.entity';

@Controller('events')
@ApiTags('events')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
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
    type: EventResponseDto 
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
   * - Supports pagination, filtering, and sorting
   */
  @Get()
  @ApiOperation({ summary: 'Get all events for your organization' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of events', 
    type: EventListResponseDto 
  })
  @ApiQuery({ name: 'status', required: false, enum: EventStatus })
  @ApiQuery({ name: 'search', required: false, description: 'Search by title' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['startDate', 'createdAt', 'title'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['ASC', 'DESC'] })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findAll(
    @Query() queryDto: QueryEventsDto,
    @CurrentUser() user: User,
  ): Promise<EventListResponseDto> {
    return this.eventsService.findAll(user.orgId, queryDto);
  }

  /**
   * Get events created by the current user
   * - Filtered to only show the user's own events
   */
  @Get('my-events')
  @ApiOperation({ summary: 'Get events created by the current user' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of user\'s events', 
    type: EventListResponseDto 
  })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async findMyEvents(
    @Query() queryDto: QueryEventsDto,
    @CurrentUser() user: User,
  ): Promise<EventListResponseDto> {
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
    type: EventResponseDto 
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
    type: EventResponseDto 
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
