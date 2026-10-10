// commit() — единственный путь записи данных Мастерской.
// Одна транзакция: записи + журнал событий + outbox для будущей синхронизации.
// После записи интерфейс получает сигнал, какие таблицы изменились.
// У Сириана доступа к commit() нет: он возвращает только сообщение или предложение (Proposal).
import type { AppEvent, Base, OutboxItem } from '../model/types';
import { db, type TableName } from '../db/schema';
import { ulid } from '../ulid';
import { emitChange } from './bus';

/** Таблицы с синхронизируемыми записями (поля Base, попадают в outbox). */
const SYNCED = new Set<TableName>(['entities', 'relations', 'spaces', 'placements', 'sketches']);

export type Change =
  | { table: TableName; put: object }
  | { table: TableName; remove: string };

export type EventInput = Omit<AppEvent, 'id' | 'at'>;

export interface CommitOptions {
  events?: EventInput[];
  /** Служебная запись без outbox и журнала (положение камеры карты, предложения). */
  local?: boolean;
}

export async function commit(changes: Change[], opts: CommitOptions = {}): Promise<void> {
  if (!changes.length && !opts.events?.length) return;
  const now = Date.now();
  const puts = new Map<TableName, object[]>();
  const removes = new Map<TableName, string[]>();
  const outbox: OutboxItem[] = [];

  for (const c of changes) {
    if ('put' in c) {
      const rec = { ...(c.put as Partial<Base> & { id?: string; entityId?: string }) };
      const key = c.table === 'sketches' ? rec.entityId : rec.id;
      if (SYNCED.has(c.table)) {
        rec.updatedAt = now;
        rec.rev = (rec.rev ?? 0) + 1;
        rec.createdAt ??= now;
        if (!opts.local && key) outbox.push({ id: ulid(now), table: c.table, recordId: key, op: 'put', at: now });
      }
      puts.set(c.table, [...(puts.get(c.table) ?? []), rec]);
    } else {
      removes.set(c.table, [...(removes.get(c.table) ?? []), c.remove]);
      if (SYNCED.has(c.table) && !opts.local) outbox.push({ id: ulid(now), table: c.table, recordId: c.remove, op: 'delete', at: now });
    }
  }
  const events: AppEvent[] = (opts.events ?? []).map((e) => ({ ...e, id: ulid(now), at: now }));

  const tables = new Set<TableName>([...puts.keys(), ...removes.keys()]);
  if (events.length) tables.add('events');
  if (outbox.length) tables.add('outbox');

  await db.transaction('rw', [...tables], async (tx) => {
    for (const [t, rows] of puts) await tx.table(t).bulkPut(rows);
    for (const [t, keys] of removes) await tx.table(t).bulkDelete(keys);
    if (events.length) await tx.table('events').bulkPut(events);
    if (outbox.length) await tx.table('outbox').bulkPut(outbox);
  });

  emitChange(tables);
}
