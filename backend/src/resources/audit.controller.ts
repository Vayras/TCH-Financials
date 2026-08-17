import { Controller, Get, Query } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { paginationParams } from '../common/pagination';
import { AuditLog } from '../entities';

@Controller('audit-logs')
@Roles('super_admin')
export class AuditController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  async list(@Query('page') page?: string, @Query('page_size') pageSize?: string) {
    const pagination = paginationParams(page, pageSize);
    const [items, total] = await this.dataSource.getRepository(AuditLog).findAndCount({
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: (pagination.page - 1) * pagination.pageSize,
      take: pagination.pageSize,
    });
    return { items, total, page: pagination.page, page_size: pagination.pageSize,
      total_pages: Math.max(1, Math.ceil(total / pagination.pageSize)) };
  }
}

