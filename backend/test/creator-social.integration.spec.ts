import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { AddCreatorSocialImports1753100000000 } from '../src/migrations/1753100000000-add-creator-social-imports';
import { CreatorSocialService, SocialActor } from '../src/creator-social/creator-social.service';
import { BrightDataClient, ProviderFailure } from '../src/creator-social/brightdata.client';
import { SocialImportProcessor } from '../src/creator-social/social-import.processor';
import { socialConfig } from '../src/creator-social/social.config';

// Explicit opt-in only; never fall back to the application's DATABASE_URL.
const databaseUrl = process.env.SOCIAL_TEST_DATABASE_URL;

test('social import integration: migration, isolation, budgets, concurrency, crash recovery and snapshots',
  { skip: !databaseUrl }, async t => {
    const url = new URL(databaseUrl!);
    assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'Integration tests require a local database.');
    const schema = `social_test_${randomUUID().replace(/-/g, '')}`;
    const admin = await new DataSource({ type: 'postgres', url: databaseUrl }).initialize();
    await admin.query(`CREATE SCHEMA ${schema}`);
    const db = await new DataSource({ type: 'postgres', url: databaseUrl,
      extra: { options: `-c search_path=${schema}`, max: 8 } }).initialize();
    const savedConfig = { ...socialConfig };
    Object.assign(socialConfig, { enabled: true, apiKey: 'test-only', datasetId: 'gd_test', creatorDailyLimit: 100, globalDailyLimit: 100 });
    try {
      await db.query('CREATE TABLE tch_creator(id bigint PRIMARY KEY)');
      await db.query('INSERT INTO tch_creator VALUES (1),(2)');
      const runner = db.createQueryRunner();
      await runner.connect();
      const migration = new AddCreatorSocialImports1753100000000();
      await migration.up(runner);
      await migration.down(runner);
      await migration.up(runner);
      await runner.release();
      const service = new CreatorSocialService(db);
      const actor: SocialActor = { id: randomUUID(), role: 'creator', creatorId: '1' };
      const other: SocialActor = { id: randomUUID(), role: 'creator', creatorId: '2' };
      const account = await service.connect(actor, '@creator_test');
      assert.equal((await service.connect(actor, 'https://instagram.com/creator_test/')).id, account.id);
      assert.deepEqual(await service.list(other), []);
      const key = randomUUID();
      const [job1, job2] = await Promise.all([service.refresh(actor, account.id, key), service.refresh(actor, account.id, key)]);
      assert.equal(job1.id, job2.id);
      await assert.rejects(service.refresh(actor, account.id, randomUUID()), { status: 409 });
      await assert.rejects(service.refresh(other, account.id, randomUUID()), { status: 404 });
      await assert.rejects(service.job(other, account.id, job1.id), { status: 404 });

      let triggers = 0;
      let downloads = 0;
      let failTrigger = false;
      let response: unknown = [{ account: 'creator_test', id: '123', followers: 7938,
        posts: [{ id: '456', likes: 36, comments: null }] }];
      const provider = new BrightDataClient();
      provider.trigger = async () => { triggers++; if (failTrigger) throw new ProviderFailure('timeout', true); return 's_test'; };
      provider.progress = async () => 'ready';
      provider.download = async () => { downloads++; return response; };
      const worker = new SocialImportProcessor(db, provider);
      await t.test('multiple workers trigger only once; save and complete are atomic', async () => {
        await Promise.all([worker.runOnce(), worker.runOnce()]);
        assert.equal(triggers, 1);
        await db.query("UPDATE tch_creator_social_import SET next_attempt_at = now() WHERE state = 'collecting'");
        await Promise.all([worker.runOnce(), worker.runOnce()]);
        assert.equal(downloads, 1);
        const snapshot = await service.snapshot(actor, account.id);
        assert.equal(snapshot.profile.followers, 7938);
        assert.equal(snapshot.posts[0].comments, null);
        assert.equal((await service.job(actor, account.id, job1.id)).state, 'succeeded');
        await assert.rejects(service.snapshot(other, account.id), { status: 404 });
        await service.list(actor);
        await service.snapshot(actor, account.id);
        assert.equal(triggers, 1, 'GETs must not collect');
      });
      await t.test('cooldown and creator/global caps reserve capacity transactionally', async () => {
        await assert.rejects(service.refresh(actor, account.id, randomUUID()), { status: 429 });
        const second = await service.connect(actor, 'second_test');
        socialConfig.creatorDailyLimit = 1;
        await assert.rejects(service.refresh(actor, second.id, randomUUID()), { status: 429 });
        socialConfig.creatorDailyLimit = 100;
        const otherAccount = await service.connect(other, 'other_test');
        socialConfig.globalDailyLimit = 1;
        await assert.rejects(service.refresh(other, otherAccount.id, randomUUID()), { status: 429 });
        socialConfig.globalDailyLimit = 100;
      });
      await t.test('invalid refresh preserves the last successful snapshot', async () => {
        await db.query("UPDATE tch_creator_social_import SET requested_at = now() - interval '2 hours'");
        const refresh = await service.refresh(actor, account.id, randomUUID());
        await worker.runOnce();
        await db.query('UPDATE tch_creator_social_import SET next_attempt_at = now() WHERE id = $1', [refresh.id]);
        response = [{ account: 'someone_else', id: '999', followers: 42 }];
        await worker.runOnce();
        assert.equal((await service.job(actor, account.id, refresh.id)).state, 'failed');
        assert.equal((await service.snapshot(actor, account.id)).profile.followers, 7938);
      });
      await t.test('ambiguous triggers block further spending and can resume a known snapshot', async () => {
        await db.query("UPDATE tch_creator_social_import SET requested_at = now() - interval '2 hours'");
        const refresh = await service.refresh(actor, account.id, randomUUID());
        failTrigger = true;
        await worker.runOnce();
        const triggerCount = triggers;
        assert.equal((await service.job(actor, account.id, refresh.id)).state, 'needs_review');
        await worker.runOnce();
        assert.equal(triggers, triggerCount);
        await assert.rejects(service.refresh(actor, account.id, randomUUID()), { status: 409 });
        assert.equal((await service.reconcile(refresh.id, 's_recovered')).state, 'collecting');
        response = [{ account: 'creator_test', id: '123', followers: 8000, posts: [] }];
        await worker.runOnce();
        assert.equal((await service.snapshot(actor, account.id)).profile.followers, 8000);
        assert.equal(triggers, triggerCount);
      });
      await t.test('expired dispatch is quarantined; expired collection resumes without dispatch', async () => {
        await db.query("UPDATE tch_creator_social_import SET requested_at = now() - interval '2 hours'");
        const refresh = await service.refresh(actor, account.id, randomUUID());
        await db.query("UPDATE tch_creator_social_import SET state = 'triggering', lease_until = now() - interval '1 minute' WHERE id = $1", [refresh.id]);
        const triggerCount = triggers;
        await worker.runOnce();
        assert.equal((await service.job(actor, account.id, refresh.id)).state, 'needs_review');
        await service.reconcile(refresh.id, 's_recovered');
        await db.query("UPDATE tch_creator_social_import SET lease_token = $2, lease_until = now() - interval '1 minute' WHERE id = $1", [refresh.id, randomUUID()]);
        await worker.runOnce();
        assert.equal((await service.job(actor, account.id, refresh.id)).state, 'succeeded');
        assert.equal(triggers, triggerCount);
      });
      await t.test('schema enforces sample bounds and removes imports when the owning creator is deleted', async () => {
        const [{ enabled }] = await db.query("SELECT relrowsecurity AS enabled FROM pg_class WHERE oid = 'tch_creator_social_snapshot'::regclass");
        assert.equal(enabled, true);
        await assert.rejects(db.query('UPDATE tch_creator_social_snapshot SET posts = $1::jsonb', [JSON.stringify(Array(51).fill({}))]));
        await db.query('DELETE FROM tch_creator WHERE id = 1');
        const [{ count }] = await db.query('SELECT count(*)::int AS count FROM tch_creator_social_snapshot');
        assert.equal(count, 0);
      });
    } finally {
      Object.assign(socialConfig, savedConfig);
      await db.destroy();
      await admin.query(`DROP SCHEMA ${schema} CASCADE`);
      await admin.destroy();
    }
  });
