import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Res,
  ParseUUIDPipe,
} from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GatewayService } from './gateway.service';
import { JwtAuthGuard } from '../modules/auth/guards';
import { CurrentUser } from '../modules/auth/decorators';
import { User } from '../modules/users/entities/user.entity';
import type {
  LoginRequestDto,
  SignupRequestDto,
  CreateEventRequestDto,
} from '../../libs/shared';

/**
 * API Gateway Controller
 * Routes HTTP requests to appropriate microservices
 */
@Controller('api/v1')
@ApiTags('Gateway')
export class GatewayController {
  private readonly cookieOptions: { httpOnly: boolean; secure: boolean };

  constructor(
    private readonly gatewayService: GatewayService,
    private configService: ConfigService,
  ) {
    this.cookieOptions = {
      httpOnly: true,
      secure: this.configService.get<string>('environment') === 'production',
    };
  }

  // ============================================
  // AUTH ENDPOINTS
  // ============================================

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials' })
  async login(
    @Body() loginDto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gatewayService.login(loginDto);

    // Set token in HttpOnly cookie
    response.cookie('access_token', result.accessToken, this.cookieOptions);

    return {
      message: 'Login successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Post('auth/signup')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  async signup(
    @Body() signupDto: SignupRequestDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.gatewayService.signup(signupDto);

    response.cookie('access_token', result.accessToken, this.cookieOptions);

    return {
      message: 'Registration successful',
      accessToken: result.accessToken,
      user: result.user,
    };
  }

  @Get('auth/me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile' })
  async getCurrentUser(@CurrentUser() user: User) {
    return {
      user,
    };
  }

  // ============================================
  // EVENTS ENDPOINTS
  // ============================================

  @Post('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create event' })
  @ApiResponse({ status: 201, description: 'Event created successfully' })
  async createEvent(
    @Body() createEventDto: CreateEventRequestDto,
    @CurrentUser() user: User,
  ) {
    const eventData: CreateEventRequestDto = {
      ...createEventDto,
      orgId: user.orgId,
      createdById: user.id,
    };

    return this.gatewayService.createEvent(eventData);
  }

  @Get('events/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event details' })
  async getEvent(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.gatewayService.getEvent(id);
  }

  @Get('events')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List events' })
  @ApiResponse({ status: 200, description: 'List of events' })
  async listEvents(
    @CurrentUser() user: User,
    @Query('skip') skip: string = '0',
    @Query('take') take: string = '10',
    @Query('status') status?: string,
  ) {
    return this.gatewayService.listEvents({
      orgId: user.orgId,
      skip: parseInt(skip, 10),
      take: parseInt(take, 10),
      status,
    });
  }

  @Post('events/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update event' })
  @ApiResponse({ status: 200, description: 'Event updated' })
  async updateEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() updateData: any,
    @CurrentUser() user: User,
  ) {
    return this.gatewayService.updateEvent({
      id,
      ...updateData,
      updatedById: user.id,
    });
  }

  @Post('events/:id/delete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete event' })
  @ApiResponse({ status: 200, description: 'Event deleted' })
  async deleteEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.gatewayService.deleteEvent(id, user.id);
  }

  @Post('events/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve event' })
  @ApiResponse({ status: 200, description: 'Event approved' })
  async approveEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: User,
  ) {
    return this.gatewayService.approveEvent(id, user.id);
  }

  @Post('events/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject event' })
  @ApiResponse({ status: 200, description: 'Event rejected' })
  async rejectEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: { reason: string },
    @CurrentUser() user: User,
  ) {
    return this.gatewayService.rejectEvent(id, body.reason, user.id);
  }
}
