import { BadRequestException, HttpException, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager, ObjectType } from 'typeorm';

export const CONFLICT_DETAIL =
  'Someone else updated this record while you were editing. Your change was ' +
  'NOT saved — reload to see the latest values, then re-apply your edit.';

interface Versioned {
  id: string;
  version: number;
}

/**
 * Optimistic locking for versioned rows, mirroring the old backend's
 * OptimisticLockMixin. Clients echo back the `version` they loaded; if
 * another save happened in between, the row's version no longer matches and
 * we answer 409 Conflict (including the current server state) instead of
 * overwriting that edit. The row is locked (SELECT ... FOR UPDATE) for the
 * check + save so two simultaneous submits serialize and the loser reliably
 * sees the conflict.
 *
 * `apply` mutates the locked entity from the payload (and may do related
 * writes through the transaction manager). `serialize` renders the wire shape
 * — used both for the 409 body and the success response.
 */
export async function versionedUpdate<T extends Versioned>(
  dataSource: DataSource,
  entity: ObjectType<T>,
  id: string,
  body: Record<string, unknown>,
  hooks: {
    apply: (row: T, manager: EntityManager) => Promise<void> | void;
    serialize: (id: string, manager: EntityManager) => Promise<unknown>;
  },
): Promise<unknown> {
  const clientVersionRaw = body?.version;
  if (clientVersionRaw === null || clientVersionRaw === undefined) {
    throw new BadRequestException({ detail: 'version is required when updating this record.' });
  }
  const clientVersion = Number(clientVersionRaw);
  if (!Number.isInteger(clientVersion)) {
    throw new BadRequestException({ detail: 'version must be an integer.' });
  }

  return dataSource.transaction(async (manager) => {
    const row = await manager
      .getRepository(entity)
      .createQueryBuilder('t')
      .setLock('pessimistic_write')
      .where('t.id = :id', { id })
      .getOne();
    if (!row) throw new NotFoundException({ detail: 'Not found.' });

    if (row.version !== clientVersion) {
      throw new HttpException(
        {
          detail: CONFLICT_DETAIL,
          code: 'version_conflict',
          current: await hooks.serialize(row.id, manager),
        },
        409,
      );
    }

    await hooks.apply(row, manager);
    row.version = clientVersion + 1;
    await manager.getRepository(entity).save(row as T);
    return hooks.serialize(row.id, manager);
  });
}
