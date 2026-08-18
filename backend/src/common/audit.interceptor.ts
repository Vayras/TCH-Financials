import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { DataSource } from 'typeorm';
import { AuditLog } from '../entities';
import { RequestWithContext, structuredLog } from './observability';

const MUTATIONS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const SECRET_FIELD = /password|token|secret|key|authorization|file/i;

export function safeFieldNames(body: unknown): string[] {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return [];
  return Object.keys(body as Record<string, unknown>)
    .filter((key) => !SECRET_FIELD.test(key))
    .sort()
    .slice(0, 100);
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<RequestWithContext>();
    const res = context.switchToHttp().getResponse<Response>();
    if (!MUTATIONS.has(req.method)) return next.handle();
    return next.handle().pipe(tap(() => {
      const requestId = req.requestId;
      if (!requestId || !/^[0-9a-f-]{36}$/i.test(requestId)) return;
      const user = req.user;
      void this.dataSource.getRepository(AuditLog).insert({
        requestId,
        actorId: user?.id && /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : null,
        actorEmail: String(user?.email ?? '').slice(0, 255),
        actorRole: String(user?.role ?? '').slice(0, 20),
        method: req.method,
        path: req.originalUrl.split('?')[0].slice(0, 500),
        resourceId: req.params?.id ? String(req.params.id).slice(0, 120) : null,
        fieldNames: safeFieldNames(req.body),
        responseStatus: res.statusCode,
      }).catch(() => structuredLog('error', 'audit_write_failed', {
        request_id: requestId, method: req.method, path: req.originalUrl.split('?')[0],
      }));
    }));
  }
}

