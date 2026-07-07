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
import { todayISO } from '../common/dates';
import { dealDocumentDto } from '../common/serializers';
import { CommercialDeal, DealDocument } from '../entities';

const DOC_TYPES = ['ClientInvoice', 'CreatorInvoice'];

// Uploads land under MEDIA_ROOT/deal_docs/<deal_id>/<filename>, mirroring the
// creator-documents layout; the API returns them as /media/... URLs.
function storeUpload(dealId: string, file: Express.Multer.File): string {
  const safeName =
    path.basename(file.originalname || 'upload').replace(/[^\w.\-()+ ]+/g, '_') || 'upload';
  const dir = path.join(env.mediaRoot, 'deal_docs', dealId);
  fs.mkdirSync(dir, { recursive: true });

  let name = safeName;
  let attempt = 0;
  while (fs.existsSync(path.join(dir, name))) {
    attempt += 1;
    const ext = path.extname(safeName);
    name = `${path.basename(safeName, ext)}_${attempt}${ext}`;
  }
  fs.writeFileSync(path.join(dir, name), file.buffer);
  return path.posix.join('deal_docs', dealId, name);
}

@Controller('deal-documents')
export class DealDocumentsController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  private repo() {
    return this.dataSource.getRepository(DealDocument);
  }

  private dealRepo() {
    return this.dataSource.getRepository(CommercialDeal);
  }

  @Get()
  async list(@Query('deal') deal?: string) {
    const rows = await this.repo().find({
      where: deal ? { dealId: deal } : {},
      order: { uploadedAt: 'DESC' },
    });
    return rows.map(dealDocumentDto);
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Body() body: Record<string, string>,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    const dealId = body.deal;
    if (!dealId) throw new BadRequestException({ deal: ['This field is required.'] });
    const deal = await this.dealRepo().findOneBy({ id: dealId });
    if (!deal) throw new BadRequestException({ deal: ['Deal not found.'] });
    if (!DOC_TYPES.includes(body.doc_type)) {
      throw new BadRequestException({
        doc_type: [`doc_type must be one of: ${DOC_TYPES.join(', ')}.`],
      });
    }
    if (!file) throw new BadRequestException({ file: ['No file was submitted.'] });

    const row = this.repo().create({
      dealId,
      docType: body.doc_type,
      label: body.label || '',
      file: storeUpload(dealId, file),
    });
    await this.repo().save(row);

    await this.maybeAutoComplete(dealId);

    const saved = await this.repo().findOneBy({ id: row.id });
    return dealDocumentDto(saved!);
  }

  // After a document is saved, check whether the deal now has at least one
  // invoice of each kind on file; if so, this is a server-initiated update —
  // not a user edit — so we bump the deal directly rather than going through
  // versionedUpdate's optimistic-lock/version-from-client flow.
  private async maybeAutoComplete(dealId: string): Promise<void> {
    const docs = await this.repo().find({ where: { dealId } });
    const hasClient = docs.some((d) => d.docType === 'ClientInvoice');
    const hasCreator = docs.some((d) => d.docType === 'CreatorInvoice');
    if (!hasClient || !hasCreator) return;

    const deal = await this.dealRepo().findOneBy({ id: dealId });
    if (!deal) return;

    let changed = false;
    if (deal.invoiceReceived !== 'Y') {
      deal.invoiceReceived = 'Y';
      changed = true;
    }
    if (deal.campaignOver !== 'Y') {
      deal.campaignOver = 'Y';
      changed = true;
    }
    if (!deal.completedAt) {
      deal.completedAt = todayISO();
      changed = true;
    }
    if (changed) {
      deal.version += 1;
      await this.dealRepo().save(deal);
    }
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
