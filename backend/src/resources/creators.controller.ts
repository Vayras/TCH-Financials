import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { applyMapped, rethrowUnique } from '../common/apply';
import { isBlank } from '../common/decimal';
import { creatorDto } from '../common/serializers';
import { versionedUpdate } from '../common/versioned-update';
import { Creator } from '../entities';

const FIELDS = {
  name: 'name',
  category: 'category',
  source: 'source',
  stage: 'stage',
  relationship: 'relationship',
  status: 'status',
  doj: 'doj',
  doj_note: 'dojNote',
  profile_url: 'profileUrl',
  location: 'location',
  ops_manager: 'opsManager',
  notes: 'notes',
};

// Everything the Add Creator form collects is mandatory (documents are
// enforced separately — they arrive via /creator-documents/ after the row is
// created). The payload merges over the existing row on update, DRF-style.
const REQUIRED: Record<string, string> = {
  name: 'Name',
  category: 'Niche',
  relationship: 'Relation',
  status: 'Status',
  doj: 'DOJ',
  profile_url: 'Profile URL',
  location: 'Location',
  ops_manager: 'Talent Manager',
};

function checkRequired(body: Record<string, unknown>, instance: Creator | null): void {
  const instanceWire: Record<string, unknown> = instance
    ? {
        name: instance.name,
        category: instance.category,
        relationship: instance.relationship,
        status: instance.status,
        doj: instance.doj,
        profile_url: instance.profileUrl,
        location: instance.location,
        ops_manager: instance.opsManager,
      }
    : {};
  const missing = Object.entries(REQUIRED)
    .filter(([field]) => isBlank(field in body ? body[field] : instanceWire[field]))
    .map(([, label]) => label);
  if (missing.length) {
    throw new BadRequestException({
      required_fields: `Please fill required creator fields: ${missing.join(', ')}.`,
    });
  }
}

@Controller('creators')
export class CreatorsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo() {
    return this.dataSource.getRepository(Creator);
  }

  @Get()
  async list() {
    const rows = await this.repo().find({ order: { name: 'ASC' } });
    return rows.map(creatorDto);
  }

  @Get(':id')
  async retrieve(@Param('id') id: string) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    return creatorDto(row);
  }

  @Post()
  @HttpCode(201)
  async create(@Body() body: Record<string, unknown>) {
    checkRequired(body, null);
    const row = this.repo().create();
    applyMapped(row as unknown as Record<string, unknown>, body, FIELDS);
    try {
      await this.repo().save(row);
    } catch (err) {
      rethrowUnique(err, 'name');
    }
    return creatorDto((await this.repo().findOneBy({ id: row.id }))!);
  }

  @Put(':id')
  replace(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.update(id, body);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return versionedUpdate(this.dataSource, Creator, id, body, {
      apply: (row) => {
        checkRequired(body, row);
        applyMapped(row as unknown as Record<string, unknown>, body, FIELDS);
      },
      serialize: async (rowId, manager) =>
        creatorDto((await manager.getRepository(Creator).findOneBy({ id: rowId }))!),
    });
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const res = await this.repo().delete({ id });
    if (!res.affected) throw new NotFoundException({ detail: 'Not found.' });
  }
}
