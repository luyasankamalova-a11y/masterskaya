// Экспорт и импорт всей Мастерской — данные всегда принадлежат пользователю.
// Архив: JSON со schemaVersion; файлы внутри в виде data URL.
import { db, SCHEMA_VERSION, TABLES, type TableName } from '../db/schema';
import type { StoredFile } from '../model/types';
import { emitChange } from './bus';

export interface ArchiveFile {
  app: 'masterskaya';
  schemaVersion: number;
  exportedAt: string;
  tables: Partial<Record<TableName, unknown[]>>;
}

const blobToDataUrl = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(b);
  });

async function dataUrlToBlob(url: string): Promise<Blob> {
  const [head, data] = url.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'application/octet-stream';
  const bin = atob(data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportArchive(): Promise<Blob> {
  const tables: ArchiveFile['tables'] = {};
  for (const t of TABLES) {
    if (t === 'outbox') continue; // очередь синхронизации — служебная, не переносится
    const rows = await db.table(t).toArray();
    tables[t] = t === 'files'
      ? await Promise.all((rows as StoredFile[]).map(async (f) => ({ ...f, blob: await blobToDataUrl(f.blob) })))
      : rows;
  }
  const archive: ArchiveFile = { app: 'masterskaya', schemaVersion: SCHEMA_VERSION, exportedAt: new Date().toISOString(), tables };
  return new Blob([JSON.stringify(archive)], { type: 'application/json' });
}

/** Импорт заменяет содержимое текущей базы содержимым архива. */
export async function importArchive(file: Blob): Promise<{ entities: number }> {
  let data: ArchiveFile;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Файл не читается как архив Мастерской'); }
  if (data.app !== 'masterskaya' || !data.tables) throw new Error('Это не архив Мастерской');
  if (data.schemaVersion > SCHEMA_VERSION) throw new Error('Архив создан более новой версией Мастерской — обнови приложение');

  const prepared: Partial<Record<TableName, unknown[]>> = {};
  for (const t of TABLES) {
    const rows = data.tables[t];
    if (!rows) continue;
    prepared[t] = t === 'files'
      ? await Promise.all((rows as (Omit<StoredFile, 'blob'> & { blob: string })[]).map(async (f) => ({ ...f, blob: await dataUrlToBlob(f.blob) })))
      : rows;
  }
  await db.transaction('rw', [...TABLES], async (tx) => {
    for (const t of TABLES) await tx.table(t).clear();
    for (const [t, rows] of Object.entries(prepared)) await tx.table(t).bulkPut(rows as object[]);
  });
  emitChange(TABLES);
  return { entities: (prepared.entities ?? []).length };
}

/** Полностью очистить текущую базу (реальную или демо — ту, что открыта). */
export async function wipeAll(): Promise<void> {
  await db.transaction('rw', [...TABLES], async (tx) => {
    for (const t of TABLES) await tx.table(t).clear();
  });
  emitChange(TABLES);
}
