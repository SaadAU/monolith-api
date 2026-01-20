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
  Req,
} from '@nestjs/common';
import type { Request, Response } from 'express';
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
import { REQUEST_ID_HEADER } from '../common/middleware';
import type {
  LoginRequestDto,
  SignupRequestDto,
  CreateEventRequestDto,
} from '../../libs/shared';

/**
 * API Gateway Controller
 * Routes HTTP requests to appropriate microservices
 * Propagates correlation IDs for distributed tracing
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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    const result = await this.gatewayService.login(loginDto, correlationId);

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
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    const result = await this.gatewayService.signup(signupDto, correlationId);

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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    const eventData: CreateEventRequestDto = {
      ...createEventDto,
      orgId: user.orgId,
      createdById: user.id,
    };

    return this.gatewayService.createEvent(eventData, correlationId);
  }

  @Get('events/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get event by ID' })
  @ApiResponse({ status: 200, description: 'Event details' })
  async getEvent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.getEvent(id, correlationId);
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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.listEvents(
      {
        orgId: user.orgId,
        skip: parseInt(skip, 10),
        take: parseInt(take, 10),
        status,
      },
      correlationId,
    );
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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.updateEvent(
      {
        id,
        ...updateData,
        updatedById: user.id,
      },
      correlationId,
    );
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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.deleteEvent(id, user.id, correlationId);
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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.approveEvent(id, user.id, correlationId);
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
    @Req() request: Request,
  ) {
    const correlationId = (request as any)[REQUEST_ID_HEADER];
    return this.gatewayService.rejectEvent(
      id,
      body.reason,
      user.id,
      correlationId,
    );
  }
}
