import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  HealthCheckDto,
  ReadinessCheckDto,
  DependencyStatus,
} from './dto/health.dto';

@Injectable()
export class HealthService {
  constructor(private readonly dataSource: DataSource) {}

  checkLiveness(): HealthCheckDto {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'EventBoard API',
    };
  }

  async checkReadiness(): Promise<ReadinessCheckDto> {
    const dependencies: DependencyStatus[] = [];
    let isReady = true;

    // Check database connection
    const dbStatus = await this.checkDatabase();
    dependencies.push(dbStatus);
    if (dbStatus.status !== 'ok') {
      isReady = false;
    }

    const result: ReadinessCheckDto = {
      status: isReady ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'EventBoard API',
      dependencies,
    };

    if (!isReady) {
      throw new ServiceUnavailableException(result);
    }

    return result;
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      // Try to execute a simple query
      await this.dataSource.query('SELECT 1');
      return {
        name: 'database',
        status: 'ok',
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'error',
        message:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }
}
