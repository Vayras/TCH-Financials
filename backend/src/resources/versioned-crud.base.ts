import {
  Body, Controller, Delete, Get, HttpCode, NotFoundException, Param, Patch,
  Post, Put, Query,
} from '@nestjs/common';
import { DataSource, EntityManager, FindOptionsOrder, ObjectType } from 'typeorm';
import { applyMapped } from '../common/apply';
import { versionedUpdate } from '../common/versioned-update';

export interface CrudConfig<T> {
  entity: ObjectType<T>;
  // wire (snake_case) -> entity prop (camelCase); FK ids map e.g. creator -> creatorId
  fields: Record<string, string>;
  dto: (row: T) => unknown;
  order: FindOptionsOrder<T>;
  relations?: string[];
  // supports ?creator={id} list filtering when true
  creatorFilter?: boolean;
}

interface HasIdVersion {
  id: string;
  version: number;
}

/**
 * Generic REST resource with DRF-ModelViewSet-compatible behavior: bare-array
 * lists, 201 create, partial PATCH/PUT with optimistic locking, 204 delete.
 * Subclasses provide the @Controller path and the config.
 */
@Controller()
export abstract class VersionedCrudBase<T extends HasIdVersion> {
  protected constructor(
    protected readonly dataSource: DataSource,
    protected readonly cfg: CrudConfig<T>,
  ) {}

  protected repo(manager?: EntityManager) {
    return (manager ?? this.dataSource).getRepository(this.cfg.entity);
  }

  protected async fetch(id: string, manager?: EntityManager): Promise<T> {
    const row = await this.repo(manager).findOne({
      where: { id } as never,
      relations: this.cfg.relations,
    });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    return row as T;
  }

  @Get()
  async list(@Query('creator') creator?: string) {
    const where = this.cfg.creatorFilter && creator ? { creatorId: creator } : {};
    const rows = await this.repo().find({
      where: where as never,
      relations: this.cfg.relations,
      order: this.cfg.order,
    });
    return (rows as T[]).map(this.cfg.dto);
  }

  @Get(':id')
  async retrieve(@Param('id') id: string) {
    return this.cfg.dto(await this.fetch(id));
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: Record<string, unknown>) {
    const row = this.repo().create() as T;
    applyMapped(row as unknown as Record<string, unknown>, body, this.cfg.fields);
    await this.repo().save(row);
    return this.cfg.dto(await this.fetch(row.id));
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.update(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return versionedUpdate(this.dataSource, this.cfg.entity as ObjectType<T & HasIdVersion>, id, body, {
      apply: (row) =>
        applyMapped(row as unknown as Record<string, unknown>, body, this.cfg.fields),
      serialize: async (rowId, manager) => this.cfg.dto(await this.fetch(rowId, manager)),
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const res = await this.repo().delete({ id } as never);
    if (!res.affected) throw new NotFoundException({ detail: 'Not found.' });
  }
}
