import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export interface DependencyStatus {
  name: string;
  status: 'ok' | 'error';
  message?: string;
}

export interface HealthCheckDto {
  status: 'ok' | 'error';
  timestamp: string;
  service: string;
}

export interface ReadinessCheckDto {
  status: 'ok' | 'degraded' | 'error';
  timestamp: string;
  service: string;
  dependencies: DependencyStatus[];
}

// Swagger response classes for documentation
export class DependencyStatusResponse {
  @ApiProperty({ example: 'database', description: 'Name of the dependency' })
  name!: string;

  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'error'],
    description: 'Status of the dependency',
  })
  status!: 'ok' | 'error';

  @ApiPropertyOptional({
    example: 'Connection refused',
    description: 'Error message if status is error',
  })
  message?: string;
}

export class HealthCheckResponse {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'error'],
    description: 'Overall health status',
  })
  status!: 'ok' | 'error';

  @ApiProperty({
    example: '2025-12-28T10:00:00.000Z',
    description: 'Timestamp of the health check',
  })
  timestamp!: string;

  @ApiProperty({
    example: 'EventBoard API',
    description: 'Name of the service',
  })
  service!: string;
}

export class ReadinessCheckResponse {
  @ApiProperty({
    example: 'ok',
    enum: ['ok', 'degraded', 'error'],
    description: 'Overall readiness status',
  })
  status!: 'ok' | 'degraded' | 'error';

  @ApiProperty({
    example: '2025-12-28T10:00:00.000Z',
    description: 'Timestamp of the health check',
  })
  timestamp!: string;

  @ApiProperty({
    example: 'EventBoard API',
    description: 'Name of the service',
  })
  service!: string;

  @ApiProperty({
    type: [DependencyStatusResponse],
    description: 'Status of all dependencies',
  })
  dependencies!: DependencyStatusResponse[];
}
