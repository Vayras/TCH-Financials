import * as fs from 'fs';
import * as path from 'path';
import {
  BadRequestException, Body, Controller, Delete, Get, HttpCode,
  NotFoundException, Param, Post, Query, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { env } from '../env';
import { creatorDocumentDto } from '../common/serializers';
import { CreatorDocument } from '../entities';

// Uploads land under MEDIA_ROOT/creator_docs/<creator_id>/<filename>, the
// same layout Django used; the API returns them as /media/... URLs.
function storeUpload(creatorId: string, file: Express.Multer.File): string {
  const safeName =
    path.basename(file.originalname || 'upload').replace(/[^\w.\-()+ ]+/g, '_') || 'upload';
  const dir = path.join(env.mediaRoot, 'creator_docs', creatorId);
  fs.mkdirSync(dir, { recursive: true });

  let name = safeName;
  let attempt = 0;
  while (fs.existsSync(path.join(dir, name))) {
    attempt += 1;
    const ext = path.extname(safeName);
    name = `${path.basename(safeName, ext)}_${attempt}${ext}`;
  }
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return path.posix.join('creator_docs', creatorId, name);
}

@Controller('creator-documents')
export class DocumentsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo() {
    return this.dataSource.getRepository(CreatorDocument);
  }

  @Get()
  async list(@Query('creator') creator?: string) {
    const rows = await this.repo().find({
      where: creator ? { creatorId: creator } : {},
      relations: ['creator'],
      order: { uploadedAt: 'DESC' },
    });
    return rows.map(creatorDocumentDto);
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const creatorId = body.creator;
    if (!creatorId) throw new BadRequestException({ creator: ['This field is required.'] });
    if (!file) throw new BadRequestException({ file: ['No file was submitted.'] });

    const row = this.repo().create({
      creatorId,
      docType: body.doc_type || 'Other',
      label: body.label || '',
      file: storeUpload(creatorId, file),
    });
    await this.repo().save(row);
    const saved = await this.repo().findOne({ where: { id: row.id }, relations: ['creator'] });
    return creatorDocumentDto(saved!);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Param('id') id: string) {
    const row = await this.repo().findOneBy({ id });
    if (!row) throw new NotFoundException({ detail: 'Not found.' });
    await this.repo().delete({ id });
    if (row.file) {
      fs.rm(path.join(env.mediaRoot, row.file), { force: true }, () => undefined);
    }
  }
}
