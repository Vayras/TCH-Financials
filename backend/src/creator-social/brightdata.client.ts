import { Injectable } from '@nestjs/common';
import { socialConfig } from './social.config';

export class ProviderFailure extends Error {
  constructor(public readonly code: string, public readonly retryable = false) { super(code); }
}

@Injectable()
export class BrightDataClient {
  // Overridable transport for tests; fixed API origin and disabled redirects prevent key leakage.
  transport: typeof fetch = (...args) => fetch(...args);

  private async request(path: string, body?: unknown): Promise<unknown> {
    try {
      const response = await this.transport(`https://api.brightdata.com/datasets/v3/${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error',
        headers: { Authorization: `Bearer ${socialConfig.apiKey}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(20000),
      });
      if (response.status === 202) {
        await response.body?.cancel();
        throw new ProviderFailure('provider_not_ready', true);
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new ProviderFailure(`provider_http_${response.status}`, response.status === 429 || response.status >= 500);
      }
      const reader = response.body?.getReader();
      if (!reader) throw new ProviderFailure('empty_provider_response');
      const chunks: Uint8Array[] = [];
      let size = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2 * 1024 * 1024) { await reader.cancel(); throw new ProviderFailure('provider_response_too_large'); }
        chunks.push(value);
      }
      try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
      catch { throw new ProviderFailure('invalid_provider_json'); }
    } catch (error) {
      if (error instanceof ProviderFailure) throw error;
      // Do not expose upstream payloads, account details or credentials in errors/logs.
      throw new ProviderFailure('provider_network_error', true);
    }
  }

  async trigger(profileUrl: string, datasetId: string): Promise<string> {
    const result = await this.request(`trigger?${new URLSearchParams({ dataset_id: datasetId, include_errors: 'true' })}`, [{ url: profileUrl }]);
    const id = (result as { snapshot_id?: unknown })?.snapshot_id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ProviderFailure('invalid_snapshot_id');
    return id;
  }

  async progress(id: string, datasetId?: string): Promise<string> {
    const result = await this.request(`progress/${encodeURIComponent(id)}`);
    if (datasetId && ((result as { dataset_id?: unknown })?.dataset_id !== datasetId ||
      (result as { snapshot_id?: unknown })?.snapshot_id !== id)) throw new ProviderFailure('provider_snapshot_mismatch');
    const status = (result as { status?: unknown })?.status;
    if (!['starting', 'running', 'ready', 'failed', 'canceled'].includes(String(status))) throw new ProviderFailure('invalid_provider_status');
    return String(status);
  }

  async discoverPosts(profileUrl: string, datasetId: string, limit: number, endDate?: string | null): Promise<string> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 30) throw new ProviderFailure('invalid_post_limit');
    const result = await this.request(`trigger?${new URLSearchParams({ dataset_id: datasetId, include_errors: 'true', type: 'discover_new', discover_by: 'url' })}`,
      [{ url: profileUrl, num_of_posts: limit, ...(endDate ? { end_date: endDate } : {}) }]);
    const id = (result as { snapshot_id?: unknown })?.snapshot_id;
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) throw new ProviderFailure('invalid_snapshot_id');
    return id;
  }

  download(id: string) { return this.request(`snapshot/${encodeURIComponent(id)}?format=json`); }
}
