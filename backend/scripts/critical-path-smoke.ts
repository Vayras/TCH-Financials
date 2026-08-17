const baseUrl = (process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');

async function expectResponse(
  name: string,
  pathname: string,
  expected: number,
  init?: RequestInit,
) {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  if (response.status !== expected) {
    throw new Error(`${name}: expected ${expected}, received ${response.status}: ${await response.text()}`);
  }
  process.stdout.write(`PASS ${name}: HTTP ${response.status}\n`);
  return response;
}

async function main() {
  await expectResponse('liveness', '/api/health/live', 200);
  await expectResponse('readiness', '/api/health/ready', 200);
  const overview = await expectResponse('overview', '/api/overview', 200);
  if (overview.headers.get('x-content-type-options') !== 'nosniff' || overview.headers.get('x-frame-options') !== 'DENY') {
    throw new Error('security_headers: required response headers are missing.');
  }
  process.stdout.write('PASS security_headers\n');
  await expectResponse('cors_rejection', '/api/overview', 403, { headers: { origin: 'https://attacker.invalid' } });
  await expectResponse('role_boundary', '/api/deals/creator-portal', 403);
  await expectResponse('payment_validation', '/api/payment-transactions', 400, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ transactionDate: '2026-02-30', vendorName: 'Smoke', utrOrRef: 'SMOKE', debitAmount: 1, creditAmount: 1 }),
  });
  await expectResponse('private_file_boundary', '/media/not-public.pdf', 404);
  process.stdout.write('[smoke] Critical read-only/negative-path checks passed.\n');
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
