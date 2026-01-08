import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UsersService } from '../services/users.service';
import { CreateUserDto, UpdateUserDto } from '../dto';
import { User, UserRole } from '../entities/user.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { Roles } from '../../auth/decorators';

@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new user (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: User,
  })
  @ApiResponse({
    status: 409,
    description: 'User with this email already exists in organization',
  })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  create(@Body() createUserDto: CreateUserDto): Promise<User> {
    return this.usersService.create(createUserDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active users (Admin/Moderator only)' })
  @ApiQuery({
    name: 'orgId',
    required: false,
    description: 'Filter by organization ID',
  })
  @ApiResponse({ status: 200, description: 'List of users', type: [User] })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  findAll(@Query('orgId') orgId?: string): Promise<User[]> {
    return this.usersService.findAll(orgId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, description: 'User found', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update user (Admin/Moderator only)' })
  @ApiResponse({ status: 200, description: 'User updated', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted' })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.usersService.remove(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MODERATOR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate user (Admin/Moderator only)' })
  @ApiResponse({ status: 200, description: 'User deactivated', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.usersService.deactivate(id);
  }
}
