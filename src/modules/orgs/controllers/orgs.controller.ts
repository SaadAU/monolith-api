import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { OrgsService } from '../services/orgs.service';
import { CreateOrgDto, UpdateOrgDto } from '../dto';
import { Org } from '../entities/org.entity';

@Controller('orgs')
@ApiTags('organizations')
export class OrgsController {
  constructor(private readonly orgsService: OrgsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new organization' })
  @ApiResponse({ status: 201, description: 'Organization created successfully', type: Org })
  @ApiResponse({ status: 409, description: 'Organization with this slug already exists' })
  create(@Body() createOrgDto: CreateOrgDto): Promise<Org> {
    return this.orgsService.create(createOrgDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all active organizations' })
  @ApiResponse({ status: 200, description: 'List of organizations', type: [Org] })
  findAll(): Promise<Org[]> {
    return this.orgsService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get organization by ID' })
  @ApiResponse({ status: 200, description: 'Organization found', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Org> {
    return this.orgsService.findOne(id);
  }

  @Get('slug/:slug')
  @ApiOperation({ summary: 'Get organization by slug' })
  @ApiResponse({ status: 200, description: 'Organization found', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  findBySlug(@Param('slug') slug: string): Promise<Org> {
    return this.orgsService.findBySlug(slug);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update organization' })
  @ApiResponse({ status: 200, description: 'Organization updated', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  @ApiResponse({ status: 409, description: 'Slug conflict' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateOrgDto: UpdateOrgDto,
  ): Promise<Org> {
    return this.orgsService.update(id, updateOrgDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete organization' })
  @ApiResponse({ status: 200, description: 'Organization deleted' })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.orgsService.remove(id);
  }

  @Patch(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate organization (soft delete)' })
  @ApiResponse({ status: 200, description: 'Organization deactivated', type: Org })
  @ApiResponse({ status: 404, description: 'Organization not found' })
  deactivate(@Param('id', ParseUUIDPipe) id: string): Promise<Org> {
    return this.orgsService.deactivate(id);
  }
}
