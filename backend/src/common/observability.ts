import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { env } from '../env';

export type RequestWithContext = Request & {
  requestId?: string;
  user?: { id?: string; email?: string; role?: string };
};

export function structuredLog(level: 'info' | 'warn' | 'error', event: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), level, event, ...fields })}\n`);
}

async function notifyOperationalFailure(payload: Record<string, unknown>) {
  if (!env.alertWebhookUrl) return;
  try {
    await fetch(env.alertWebhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(3000),
    });
  } catch {
    structuredLog('error', 'operational_alert_delivery_failed');
  }
}

export function requestContext(req: RequestWithContext, res: Response, next: NextFunction) {
  const supplied = req.header('x-request-id');
  req.requestId = supplied && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(supplied)
    ? supplied
    : randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  const startedAt = Date.now();
  res.on('finish', () => {
    const fields = {
      request_id: req.requestId,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      duration_ms: Date.now() - startedAt,
      actor_id: req.user?.id ?? null,
      actor_role: req.user?.role ?? null,
    };
    structuredLog(res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info', 'http_request', fields);
    if (res.statusCode >= 500) {
      void notifyOperationalFailure({ event: 'tch_api_5xx', ...fields });
    }
  });
  next();
}
