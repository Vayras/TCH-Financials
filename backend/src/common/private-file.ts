import * as fs from 'fs';
import * as path from 'path';
import { NotFoundException, StreamableFile } from '@nestjs/common';
import { env } from '../env';

const MIME_BY_EXTENSION: Record<string, string> = {
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

export function privateFile(storedPath: string, label?: string): StreamableFile {
  const root = path.resolve(env.mediaRoot);
  const absolute = path.resolve(root, storedPath);
  if (!storedPath || (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))) {
    throw new NotFoundException({ detail: 'File not found.' });
  }
  if (!fs.existsSync(absolute) || !fs.statSync(absolute).isFile()) {
    throw new NotFoundException({ detail: 'File not found.' });
  }
  const filename = path.basename(label || storedPath).replace(/[\r\n"]/g, '_');
  const type = MIME_BY_EXTENSION[path.extname(absolute).toLowerCase()] ?? 'application/octet-stream';
  return new StreamableFile(fs.createReadStream(absolute), {
    type,
    disposition: `attachment; filename="${filename}"`,
  });
}

export function removePrivateFile(storedPath: string): void {
  const root = path.resolve(env.mediaRoot);
  const absolute = path.resolve(root, storedPath);
  if (!storedPath || (absolute !== root && !absolute.startsWith(`${root}${path.sep}`))) return;
  fs.rm(absolute, { force: true }, () => undefined);
}
