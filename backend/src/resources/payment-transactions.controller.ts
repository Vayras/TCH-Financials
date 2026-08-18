import { Controller, Get, Post, Body, Query, UseInterceptors, UploadedFile, BadRequestException, ConflictException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { paginationParams } from '../common/pagination';
import { FileInterceptor } from '@nestjs/platform-express';
import { readSheet, type CellValue, type Row } from 'read-excel-file/node';
import { SPREADSHEET_MIME, UPLOAD_LIMITS, validateUpload } from '../common/uploads';
import { optionalDate, requiredText, strictDecimal } from '../common/integrity';
import { CommercialDeal, Creator } from '../entities';

type PaymentInput = {
  transactionDate: unknown;
  vendorName: unknown;
  utrOrRef: unknown;
  debitAmount?: unknown;
  creditAmount?: unknown;
  dealId?: string | null;
  creatorId?: string | null;
  notes?: unknown;
};

export function normalizedPayment(body: PaymentInput) {
  const transactionDate = optionalDate(body.transactionDate, 'transactionDate');
  if (!transactionDate) throw new BadRequestException({ transactionDate: ['Transaction date is required.'] });
  const debit = strictDecimal(body.debitAmount ?? 0, 'debitAmount', { min: 0, scale: 2 });
  const credit = strictDecimal(body.creditAmount ?? 0, 'creditAmount', { min: 0, scale: 2 });
  if ((debit.isZero() && credit.isZero()) || (!debit.isZero() && !credit.isZero())) {
    throw new BadRequestException({ detail: 'Enter exactly one positive debit or credit amount.' });
  }
  return {
    transactionDate,
    vendorName: requiredText(body.vendorName, 'vendorName', 200),
    utrOrRef: requiredText(body.utrOrRef, 'utrOrRef', 120),
    debitAmount: debit.toFixed(2),
    creditAmount: credit.toFixed(2),
    dealId: body.dealId || null,
    creatorId: body.creatorId || null,
    notes: String(body.notes ?? '').trim(),
  };
}

@Roles('super_admin', 'accounts')
@Controller('payment-transactions')
export class PaymentTransactionsController {
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async list(
    @Query('page') page?: string,
    @Query('page_size') pageSize?: string,
    @Query('search') search?: string,
  ) {
    const pagination = paginationParams(page, pageSize);
    const repo = this.dataSource.getRepository(PaymentTransaction);

    const qb = repo.createQueryBuilder('pt')
      .leftJoinAndSelect('pt.deal', 'deal')
      .leftJoinAndSelect('pt.creator', 'creator')
      .orderBy('pt.transactionDate', 'DESC')
      .addOrderBy('pt.id', 'DESC');

    if (search?.trim()) {
      qb.andWhere(
        '(pt.vendorName ILIKE :search OR pt.utrOrRef ILIKE :search OR pt.notes ILIKE :search)',
        { search: `%${search.trim()}%` }
      );
    }

    const total = await qb.getCount();
    
    // Get sums of debits and credits
    const sums = await qb.clone()
      .select('SUM(pt.debitAmount)', 'debit')
      .addSelect('SUM(pt.creditAmount)', 'credit')
      .getRawOne<{ debit: string | null; credit: string | null }>();

    const items = await qb
      .skip((pagination.page - 1) * pagination.pageSize)
      .take(pagination.pageSize)
      .getMany();

    return {
      items,
      page: pagination.page,
      page_size: pagination.pageSize,
      total,
      total_pages: Math.max(1, Math.ceil(total / pagination.pageSize)),
      summary: {
        total_debit: sums?.debit || '0.00',
        total_credit: sums?.credit || '0.00',
      }
    };
  }

  @Post()
  async create(
    @Body() body: PaymentInput,
  ) {
    const repo = this.dataSource.getRepository(PaymentTransaction);
    const values = normalizedPayment(body);
    if (values.dealId && !await this.dataSource.getRepository(CommercialDeal).existsBy({ id: values.dealId })) {
      throw new BadRequestException({ dealId: ['Deal not found.'] });
    }
    if (values.creatorId && !await this.dataSource.getRepository(Creator).existsBy({ id: values.creatorId })) {
      throw new BadRequestException({ creatorId: ['Creator not found.'] });
    }
    const duplicate = await repo.existsBy({
      transactionDate: values.transactionDate, vendorName: values.vendorName,
      utrOrRef: values.utrOrRef, debitAmount: values.debitAmount, creditAmount: values.creditAmount,
    });
    if (duplicate) throw new ConflictException({ detail: 'This payment transaction already exists.' });
    const pt = repo.create(values);
    try {
      return await repo.save(pt);
    } catch (error) {
      if ((error as { code?: string })?.code === '23505') {
        throw new ConflictException({ detail: 'This payment transaction already exists.' });
      }
      throw error;
    }
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file', { limits: UPLOAD_LIMITS }))
  async importExcel(@UploadedFile() file: any) {
    validateUpload(file, 'No file uploaded.', SPREADSHEET_MIME);

    try {
      const sheetRows = await readSheet(file.buffer);
      if (!sheetRows.length) throw new BadRequestException('The spreadsheet is empty.');
      const headers = sheetRows[0].map((cell) => String(cell ?? '').trim());
      const column = (name: string) => headers.indexOf(name);
      const cellAt = (row: Row, name: string): CellValue | null => {
        const index = column(name);
        return index >= 0 ? row[index] : null;
      };

      const pending: ReturnType<typeof normalizedPayment>[] = [];
      const skipped: Array<{ row: number; reason: string }> = [];
      const seen = new Set<string>();

      for (let i = 1; i < sheetRows.length; i++) {
        const row = sheetRows[i];
        
        // Excel headers: Transaction Date | Vendor Name | Cheque/UTR or Ref No | Debit Amount | Credit Amount
        const dateRaw = cellAt(row, 'Transaction Date');
        const vendor = cellAt(row, 'Vendor Name');
        const utr = cellAt(row, 'Cheque/UTR or Ref No');
        const debit = cellAt(row, 'Debit Amount') || 0;
        const credit = cellAt(row, 'Credit Amount') || 0;

        if (!dateRaw || !vendor || !utr) {
          skipped.push({ row: i + 1, reason: 'Missing required columns (Date, Vendor, or UTR/Ref).' });
          continue;
        }

        // Format date string from raw input
        let dateStr = '';
        if (dateRaw instanceof Date) {
          dateStr = dateRaw.toISOString().slice(0, 10);
        } else if (typeof dateRaw === 'number') {
          // Excel serial date number
          const dateObj = new Date((dateRaw - 25569) * 86400 * 1000);
          dateStr = dateObj.toISOString().slice(0, 10);
        } else {
          // Try parsing standard formats like dd-mm-yyyy or yyyy-mm-dd
          const parts = String(dateRaw).split(/[-/]/);
          if (parts.length === 3) {
            if (parts[2].length === 4) { // dd-mm-yyyy
              dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (parts[0].length === 4) { // yyyy-mm-dd
              dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            }
          }
        }

        if (!dateStr || isNaN(Date.parse(dateStr))) {
          skipped.push({ row: i + 1, reason: `Invalid date format: ${dateRaw}.` });
          continue;
        }
        try {
          const values = normalizedPayment({
            transactionDate: dateStr, vendorName: vendor, utrOrRef: utr,
            debitAmount: debit, creditAmount: credit,
            notes: cellAt(row, 'Notes') || 'Imported via Excel',
          });
          const key = [values.transactionDate, values.vendorName.toLowerCase(), values.utrOrRef.toLowerCase(), values.debitAmount, values.creditAmount].join('|');
          if (seen.has(key)) {
            skipped.push({ row: i + 1, reason: 'Duplicate row in this spreadsheet.' });
            continue;
          }
          seen.add(key);
          pending.push(values);
        } catch (error: any) {
          skipped.push({ row: i + 1, reason: error?.response?.detail ?? 'Invalid debit or credit amount.' });
        }
      }

      const importedCount = await this.dataSource.transaction(async (manager) => {
        const repo = manager.getRepository(PaymentTransaction);
        let count = 0;
        for (const values of pending) {
          const duplicate = await repo.existsBy({
            transactionDate: values.transactionDate, vendorName: values.vendorName,
            utrOrRef: values.utrOrRef, debitAmount: values.debitAmount, creditAmount: values.creditAmount,
          });
          if (duplicate) {
            skipped.push({ row: count + 2, reason: 'Transaction already exists.' });
            continue;
          }
          await repo.save(repo.create(values));
          count += 1;
        }
        return count;
      });

      return {
        success: true,
        imported_count: importedCount,
        skipped,
      };
    } catch (e: any) {
      throw new BadRequestException(`Excel parsing failed: ${e.message}`);
    }
  }
}
