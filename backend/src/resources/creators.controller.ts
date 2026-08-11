import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Patch, Post, Put, Query,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { applyMapped, rethrowUnique } from '../common/apply';
import { isBlank } from '../common/decimal';
import { creatorDto } from '../common/serializers';
import { versionedUpdate } from '../common/versioned-update';
import { paginationParams } from '../common/pagination';
import { Creator } from '../entities';
import { createClient } from '@supabase/supabase-js';
import { Profile } from '../entities/profile.entity';
import { env } from '../env';
import * as https from 'https';


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
  email: 'email',
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
  const rel = body.relationship || (instance ? instance.relationship : null);
  const missing = Object.entries(REQUIRED)
    .filter(([field]) => {
      if ((field === 'doj' || field === 'status') && rel !== 'Exclusive') {
        return false;
      }
      return isBlank(field in body ? body[field] : instanceWire[field]);
    })
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
  async list(
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('search') search?: string,
    @Query('relationship') relationship?: string,
    @Query('status') status?: string,
    @Query('sort_by') sortBy?: string,
    @Query('sort_order') sortOrder?: string,
  ) {
    const pagination = paginationParams(page, pageSize);
    const qb = this.repo().createQueryBuilder('creator');
    if (search?.trim()) {
      qb.andWhere(`(
        creator.name ILIKE :search OR creator.category ILIKE :search OR
        creator.ops_manager ILIKE :search OR creator.location ILIKE :search
      )`, { search: `%${search.trim()}%` });
    }
    if (relationship) qb.andWhere('creator.relationship = :relationship', { relationship });
    if (status) qb.andWhere('creator.status = :status', { status });

    const sortMap: Record<string, string> = {
      name: 'creator.name', category: 'creator.category', relationship: 'creator.relationship',
      status: 'creator.status', doj: 'creator.doj', location: 'creator.location',
      ops_manager: 'creator.opsManager', created_at: 'creator.createdAt',
    };
    const sortKey = sortBy ?? 'name';
    if (!sortMap[sortKey]) {
      throw new BadRequestException({ detail: `sort_by must be one of: ${Object.keys(sortMap).join(', ')}.` });
    }
    const requestedOrder = (sortOrder ?? 'asc').toLowerCase();
    if (requestedOrder !== 'asc' && requestedOrder !== 'desc') {
      throw new BadRequestException({ detail: 'sort_order must be asc or desc.' });
    }
    qb.orderBy(sortMap[sortKey], requestedOrder.toUpperCase() as 'ASC' | 'DESC').addOrderBy('creator.id', 'ASC');

    if (!pagination.requested) return (await qb.getMany()).map(creatorDto);
    const total = await qb.getCount();
    const rows = await qb.skip((pagination.page - 1) * pagination.pageSize).take(pagination.pageSize).getMany();
    return {
      items: rows.map(creatorDto), page: pagination.page, page_size: pagination.pageSize,
      total, total_pages: Math.max(1, Math.ceil(total / pagination.pageSize)), summary: {},
    };
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

  @Post(':id/create-account')
  async createAccount(
    @Param('id') id: string,
    @Body() body: { password?: string }
  ) {
    const creatorRepo = this.repo();
    const creator = await creatorRepo.findOneBy({ id });
    if (!creator) throw new NotFoundException({ detail: 'Creator not found.' });
    if (!creator.email) {
      throw new BadRequestException('Creator must have an email address to create a login account.');
    }
    if (creator.portalStatus === 'active') {
      throw new BadRequestException('Creator already has an active portal account.');
    }

    const email = creator.email.trim().toLowerCase();
    const password = body.password?.trim();
    if (!password || password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters.');
    }

    // 1. Create user in Supabase auth using raw HTTPS to avoid local fetch proxy/TLS issues
    const authUserId = await new Promise<string>((resolve, reject) => {
      const payload = JSON.stringify({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'creator' }
      });

      const req = https.request(`${env.supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'apikey': env.supabaseServiceRoleKey,
          'Authorization': 'Bearer ' + env.supabaseServiceRoleKey,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsed = JSON.parse(data);
              if (parsed.id) {
                resolve(parsed.id);
              } else {
                reject(new Error('User ID missing in Supabase response.'));
              }
            } catch {
              reject(new Error('Failed to parse Supabase response.'));
            }
          } else {
            try {
              const parsed = JSON.parse(data);
              reject(new Error(parsed.message || `HTTP ${res.statusCode}`));
            } catch {
              reject(new Error(`HTTP ${res.statusCode}`));
            }
          }
        });
      });

      req.on('error', (e) => {
        reject(e);
      });

      req.write(payload);
      req.end();
    }).catch(err => {
      console.error('SUPABASE_AUTH_RAW_ERROR:', err);
      throw new BadRequestException(`Supabase account creation failed: ${err.message}`);
    });

    // 2. Create Profile record in database
    const profileRepo = this.dataSource.getRepository(Profile);
    const profile = profileRepo.create({
      id: authUserId,
      email,
      displayName: creator.name || '',
      role: 'creator',
      status: 'approved',
      passwordSet: true,
      creatorId: creator.id
    });

    await profileRepo.save(profile);

    // 3. Update Creator portalStatus
    creator.portalStatus = 'active';
    await creatorRepo.save(creator);

    return { success: true, profile };
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const res = await this.repo().delete({ id });
    if (!res.affected) throw new NotFoundException({ detail: 'Not found.' });
  }
}
