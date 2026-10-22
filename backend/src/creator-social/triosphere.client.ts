import { Injectable } from '@nestjs/common';

export class ProviderFailure extends Error {
  constructor(
    public readonly code: string,
    public readonly retryable = false,
    public readonly retryAfterMs?: number,
  ) {
    super(code);
  }
}

@Injectable()
export class TrioSphereClient {
  transport: typeof fetch = (...args) => fetch(...args);

  constructor(private readonly token: string) {}

  async lookup(username: string): Promise<unknown> {
    const url = new URL('https://api.triosphere.site/v1/profile-lookup');
    url.search = new URLSearchParams({ username, posts: 'true' }).toString();
    let response: Response;
    try {
      response = await this.transport(url, {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(20_000),
        headers: { Accept: 'application/json', Authorization: `Bearer ${this.token}` },
      });
    } catch {
      throw new ProviderFailure('provider_network_error', true);
    }
    if (!response.ok) {
      const retryAfter = response.headers.get('retry-after');
      await response.body?.cancel();
      if (response.status === 429)
        throw new ProviderFailure(
          'provider_rate_limited',
          true,
          retryAfter ? retryAfterMs(retryAfter) : undefined,
        );
      if ([400, 401, 403, 404].includes(response.status)) {
        throw new ProviderFailure(
          response.status === 400
            ? 'invalid_username'
            : response.status === 404
              ? 'profile_unavailable'
              : 'provider_auth_failed',
        );
      }
      if ([409, 424].includes(response.status))
        throw new ProviderFailure('provider_connection_failed');
      throw new ProviderFailure(`provider_http_${response.status}`, response.status >= 500);
    }
    const reader = response.body?.getReader();
    if (!reader) throw new ProviderFailure('empty_provider_response');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 2 * 1024 * 1024) {
        await reader.cancel();
        throw new ProviderFailure('provider_response_too_large');
      }
      chunks.push(value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      throw new ProviderFailure('invalid_provider_json');
    }
  }
}

function retryAfterMs(value: string) {
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(seconds * 1000, 60 * 60 * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date)
    ? Math.max(0, Math.min(date - Date.now(), 60 * 60 * 1000))
    : undefined;
}
