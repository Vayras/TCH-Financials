import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { AuthController } from '../src/auth/auth.controller';

function controllerWith(profile: Record<string, unknown> | null) {
  const saved: Record<string, unknown>[] = [];
  const repo = {
    findOneBy: async () => (profile ? { ...profile } : null),
    save: async (value: Record<string, unknown>) => {
      saved.push(value);
      return value;
    },
  };
  const controller = new AuthController({ getRepository: () => repo } as never);
  return { controller, saved };
}

const request = (email: string | undefined) => ({ user: { id: 'user-1', email } }) as never;

test('complete-password-setup accepts a profile email stored with different case', async () => {
  const { controller, saved } = controllerWith({
    id: 'user-1',
    email: 'Jane@Brand.com',
    status: 'approved',
    passwordSet: false,
  });
  assert.deepEqual(await controller.completePasswordSetup(request('jane@brand.com')), {
    success: true,
  });
  assert.equal(saved[0].passwordSet, true);
});

test('complete-password-setup still rejects a different, missing or unapproved account', async () => {
  const approved = { id: 'user-1', email: 'jane@brand.com', status: 'approved' };
  for (const [profile, email] of [
    [approved, 'someone@else.com'],
    [approved, undefined],
    [{ ...approved, email: '' }, ''],
    [{ ...approved, status: 'pending' }, 'jane@brand.com'],
    [null, 'jane@brand.com'],
  ] as const) {
    const { controller, saved } = controllerWith(profile);
    await assert.rejects(controller.completePasswordSetup(request(email)), { status: 401 });
    assert.equal(saved.length, 0);
  }
});
