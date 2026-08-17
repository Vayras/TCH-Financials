import { BadRequestException } from '@nestjs/common';

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const UPLOAD_LIMITS = { fileSize: MAX_UPLOAD_BYTES };

export const DOCUMENT_MIME = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export const SPREADSHEET_MIME = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

export function validateUpload(
  file: Express.Multer.File | undefined,
  missingMessage = 'Choose a file to upload.',
  allowedMime = DOCUMENT_MIME,
): asserts file is Express.Multer.File {
  if (!file) throw new BadRequestException({ file: [missingMessage] });
  if (!allowedMime.has(file.mimetype)) {
    throw new BadRequestException({ file: ['This file type is not allowed.'] });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BadRequestException({ file: ['The maximum file size is 15 MB.'] });
  }
}
