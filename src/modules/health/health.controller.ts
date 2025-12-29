import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { HealthService } from './health.service';
import type { HealthCheckDto, ReadinessCheckDto } from './dto/health.dto';
import { HealthCheckResponse, ReadinessCheckResponse } from './dto/health.dto';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('live')
  @ApiOperation({
    summary: 'Liveness probe',
    description: 'Check if the application is alive and responding',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
    type: HealthCheckResponse,
  })
  getLiveness(): HealthCheckDto {
    return this.healthService.checkLiveness();
  }

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness probe',
    description: 'Check if the application is ready to accept traffic (database connected, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
    type: ReadinessCheckResponse,
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async getReadiness(): Promise<ReadinessCheckDto> {
    return this.healthService.checkReadiness();
  }
}
