// Синхронизация. Этап 0 работает полностью локально (LocalOnlyAdapter).
// Позже CloudAdapter прочитает тот же outbox: ULID, rev и deletedAt уже есть в каждой записи.
import type { OutboxItem } from '../model/types';

export interface SyncAdapter {
  readonly name: string;
  /** Отправить накопленные изменения. Возвращает id отправленных элементов outbox. */
  push(items: OutboxItem[]): Promise<string[]>;
  /** Получить изменения с сервера после отметки времени. */
  pull(since: number): Promise<{ table: string; record: unknown }[]>;
}

export class LocalOnlyAdapter implements SyncAdapter {
  readonly name = 'local';
  async push(): Promise<string[]> { return []; }
  async pull(): Promise<{ table: string; record: unknown }[]> { return []; }
}

export const syncAdapter: SyncAdapter = new LocalOnlyAdapter();
