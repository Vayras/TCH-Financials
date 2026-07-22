import { BadRequestException } from '@nestjs/common';

export interface PaginationParams {
  page: number;
  pageSize: number;
  requested: boolean;
}

export function paginationParams(page?: string, pageSize?: string): PaginationParams {
  const requested = page !== undefined || pageSize !== undefined;
  const parsedPage = page === undefined ? 1 : Number(page);
  const parsedSize = pageSize === undefined ? 25 : Number(pageSize);
  if (!Number.isInteger(parsedPage) || parsedPage < 1) {
    throw new BadRequestException({ detail: 'page must be a positive integer.' });
  }
  if (!Number.isInteger(parsedSize) || parsedSize < 1 || parsedSize > 100) {
    throw new BadRequestException({ detail: 'page_size must be between 1 and 100.' });
  }
  return { page: parsedPage, pageSize: parsedSize, requested };
}

export function csvValues(value?: string): string[] {
  return (value ?? '').split(',').map((item) => item.trim()).filter(Boolean);
}
