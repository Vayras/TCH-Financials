import { Controller, Get, Post, Body, Query, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Roles } from '../auth/roles.decorator';
import { PaymentTransaction } from '../entities/payment-transaction.entity';
import { paginationParams } from '../common/pagination';
import { FileInterceptor } from '@nestjs/platform-express';
import * as xlsx from 'xlsx';

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
    @Body() body: {
      transactionDate: string;
      vendorName: string;
      utrOrRef: string;
      debitAmount?: number;
      creditAmount?: number;
      dealId?: string | null;
      creatorId?: string | null;
      notes?: string;
    }
  ) {
    const repo = this.dataSource.getRepository(PaymentTransaction);
    const pt = repo.create({
      transactionDate: body.transactionDate,
      vendorName: body.vendorName,
      utrOrRef: body.utrOrRef,
      debitAmount: String(body.debitAmount || 0),
      creditAmount: String(body.creditAmount || 0),
      dealId: body.dealId || null,
      creatorId: body.creatorId || null,
      notes: body.notes || '',
    });
    return repo.save(pt);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importExcel(@UploadedFile() file: any) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    try {
      const workbook = xlsx.read(file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = xlsx.utils.sheet_to_json<any>(sheet);

      const repo = this.dataSource.getRepository(PaymentTransaction);
      const imported: PaymentTransaction[] = [];
      const skipped: Array<{ row: number; reason: string }> = [];

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        
        // Excel headers: Transaction Date | Vendor Name | Cheque/UTR or Ref No | Debit Amount | Credit Amount
        const dateRaw = row['Transaction Date'];
        const vendor = row['Vendor Name'];
        const utr = row['Cheque/UTR or Ref No'];
        const debit = Number(row['Debit Amount'] || 0);
        const credit = Number(row['Credit Amount'] || 0);

        if (!dateRaw || !vendor || !utr) {
          skipped.push({ row: i + 2, reason: 'Missing required columns (Date, Vendor, or UTR/Ref).' });
          continue;
        }

        // Format date string from raw input
        let dateStr = '';
        if (typeof dateRaw === 'number') {
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
          skipped.push({ row: i + 2, reason: `Invalid date format: ${dateRaw}.` });
          continue;
        }

        const pt = repo.create({
          transactionDate: dateStr,
          vendorName: String(vendor),
          utrOrRef: String(utr),
          debitAmount: debit.toFixed(2),
          creditAmount: credit.toFixed(2),
          notes: row['Notes'] || 'Imported via Excel',
        });
        
        await repo.save(pt);
        imported.push(pt);
      }

      return {
        success: true,
        imported_count: imported.length,
        skipped,
      };
    } catch (e: any) {
      throw new BadRequestException(`Excel parsing failed: ${e.message}`);
    }
  }
}
