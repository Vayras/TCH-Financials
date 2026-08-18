import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { SkipAuth } from './auth/skip-auth.decorator';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @SkipAuth()
  health() { return this.ready(); }

  @Get('live')
  @SkipAuth()
  live() { return { status: 'ok' }; }

  @Get('ready')
  @SkipAuth()
  async ready() {
    try {
      await this.dataSource.query('SELECT 1');
      const pendingMigrations = await this.dataSource.showMigrations();
      if (pendingMigrations) {
        throw new ServiceUnavailableException({ status: 'unavailable', database: 'reachable', migrations: 'pending' });
      }
      return { status: 'ok', database: 'reachable', migrations: 'current' };
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException({ status: 'unavailable', database: 'unreachable' });
    }
  }
}
