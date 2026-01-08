import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { OrgsService } from '../services/orgs.service';
import { CreateOrgDto, UpdateOrgDto } from '../dto';
import { Org } from '../entities/org.entity';
import { JwtAuthGuard, RolesGuard } from '../../auth/guards';
import { Roles, CurrentUser } from '../../auth/decorators';
import { UserRole, User } from '../../users/entities/user.entity';

@Controller('orgs')
@ApiTags('organizations')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new organization (Admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Organization created successfully',
    type: Org,
  })
  @ApiResponse({
    status: 409,
    description: 'Organization with this slug already exists',
  })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({ description: 'User does not have required role' })
  create(@Body() createOrgDto: CreateOrgDto): Promise<Org> {
    return this.orgsService.create(createOrgDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all active organizations' })
  @ApiResponse({
    status: 200,
    description: 'List of organizations',
    type: [Org],
  })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  findAll(): Promise<Org[]> {
    return this.orgsService.findAll();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization found', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Org> {
    return this.orgsService.findOne(id);
  }

  @Get('slug/:slug')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get organization by slug' })
  @ApiResponse({ status: 200, description: 'Organization found', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  findBySlug(@Param('slug') slug: string): Promise<Org> {
    return this.orgsService.findBySlug(slug);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update organization (Admin only, own org)' })
  @ApiResponse({ status: 200, description: 'Organization updated', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({
    description: 'User does not have required role or not member of org',
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrgDto: UpdateOrgDto,
    @CurrentUser() user: User,
  ): Promise<Org> {
    if (user.orgId !== id) {
      throw new ForbiddenException('You can only update your own organization');
    }
    return this.orgsService.update(id, updateOrgDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete organization (Admin only, own org)' })
  @ApiResponse({ status: 200, description: 'Organization deleted' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({
    description: 'User does not have required role or not member of org',
  })
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    if (user.orgId !== id) {
      throw new ForbiddenException('You can only delete your own organization');
    }
    return this.orgsService.remove(id);
  }

  @Patch(':id/deactivate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Deactivate organization (Admin only, own org)' })
  @ApiResponse({
    status: 200,
    description: 'Organization deactivated',
    type: Org,
  })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiUnauthorizedResponse({
    description: 'Not authenticated or invalid token',
  })
  @ApiForbiddenResponse({
    description: 'User does not have required role or not member of org',
  })
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: User,
  ): Promise<Org> {
    if (user.orgId !== id) {
      throw new ForbiddenException(
        'You can only deactivate your own organization',
      );
    }
    return this.orgsService.deactivate(id);
  }
}
