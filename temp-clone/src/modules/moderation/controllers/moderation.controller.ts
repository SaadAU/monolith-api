import {
  Controller,
  Post,
  Get,
  Body,
  Param,
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
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { ModerationService } from '../services/moderation.service';
import {
  RejectEventDto,
  ModerationResponseDto,
  PendingModerationListDto,
} from '../dto';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { CurrentUser, Roles } from '../../auth/decorators';
import { User, UserRole } from '../../users/entities/user.entity';

@Controller('moderation')
@ApiTags('moderation')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ModerationController {
  constructor(private readonly moderationService: ModerationService) {}

  /**
   * Submit an event for moderation review
   * - Only the event owner can submit
   * - Event must be in DRAFT status
   */
  @Post('events/:id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit event for moderation (owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Event submitted for review',
    type: ModerationResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiConflictResponse({ description: 'Event already submitted' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Not the event owner' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async submitEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ModerationResponseDto> {
    return this.moderationService.submit(id, user);
  }

  /**
   * Approve a submitted event
   * - Only moderators and admins can approve
   * - Event must be in SUBMITTED status
   */
  @Post('events/:id/approve')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve event (moderator/admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Event approved',
    type: ModerationResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Invalid status transition' })
  @ApiConflictResponse({ description: 'Event already approved' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Requires moderator or admin role' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async approveEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ModerationResponseDto> {
    return this.moderationService.approve(id, user);
  }

  /**
   * Reject a submitted event
   * - Only moderators and admins can reject
   * - Event must be in SUBMITTED status
   * - Must provide a rejection reason
   */
  @Post('events/:id/reject')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject event (moderator/admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Event rejected',
    type: ModerationResponseDto,
  })
  @ApiBadRequestResponse({
    description: 'Invalid status transition or missing reason',
  })
  @ApiConflictResponse({ description: 'Event already rejected' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Requires moderator or admin role' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async rejectEvent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rejectDto: RejectEventDto,
    @CurrentUser() user: User,
  ): Promise<ModerationResponseDto> {
    return this.moderationService.reject(id, user, rejectDto.reason);
  }

  /**
   * Revert a rejected event back to draft for editing
   * - Only the event owner can revert
   * - Event must be in REJECTED status
   */
  @Post('events/:id/revert-to-draft')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revert rejected event to draft (owner only)' })
  @ApiResponse({
    status: 200,
    description: 'Event reverted to draft',
    type: ModerationResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Event not in rejected status' })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiForbiddenResponse({ description: 'Not the event owner' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async revertToDraft(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ModerationResponseDto> {
    return this.moderationService.revertToDraft(id, user);
  }

  /**
   * Get all events pending moderation
   * - Only moderators and admins can view
   * - Returns events in SUBMITTED status, ordered by submission date
   */
  @Get('events/pending')
  @UseGuards(RolesGuard)
  @Roles(UserRole.MODERATOR, UserRole.ADMIN)
  @ApiOperation({ summary: 'Get pending events (moderator/admin only)' })
  @ApiResponse({
    status: 200,
    description: 'List of events pending moderation',
    type: PendingModerationListDto,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    type: Number,
    description: 'Page number',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Items per page',
  })
  @ApiForbiddenResponse({ description: 'Requires moderator or admin role' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getPendingEvents(
    @CurrentUser() user: User,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<PendingModerationListDto> {
    return this.moderationService.getPendingEvents(
      user,
      page ? Number(page) : 1,
      limit ? Number(limit) : 10,
    );
  }

  /**
   * Get moderation status for a specific event
   */
  @Get('events/:id/status')
  @ApiOperation({ summary: 'Get event moderation status' })
  @ApiResponse({
    status: 200,
    description: 'Event moderation status',
    type: ModerationResponseDto,
  })
  @ApiNotFoundResponse({ description: 'Event not found' })
  @ApiUnauthorizedResponse({ description: 'Not authenticated' })
  async getEventStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<ModerationResponseDto> {
    return this.moderationService.getEventModerationStatus(id, user.orgId);
  }
}
