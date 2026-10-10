// Хранилище файлов: Blob в IndexedDB (в пределах квоты устройства), в объекте — только ссылка FileRef.
// Извлечение текста PDF и нарезка на фрагменты — этап 1; перенос больших файлов в облако — этап 7.
import type { EntityType, FileRef, StoredFile } from '../core/model/types';
import { db } from '../core/db/schema';
import { commit } from '../core/repo/commit';
import { ulid } from '../core/ulid';

export async function storeFile(file: Blob, name = (file as File).name ?? 'файл'): Promise<FileRef> {
  const rec: StoredFile = { id: ulid(), blob: file, name, mime: file.type || 'application/octet-stream', size: file.size, createdAt: Date.now() };
  await commit([{ table: 'files', put: rec }], { local: true });
  return { fileId: rec.id, name, mime: rec.mime, size: rec.size, storage: 'local' };
}

export const loadFile = (fileId: string) => db.files.get(fileId);

const urlCache = new Map<string, string>();

export async function fileUrl(fileId: string): Promise<string | undefined> {
  const hit = urlCache.get(fileId);
  if (hit) return hit;
  const f = await loadFile(fileId);
  if (!f) return undefined;
  const url = URL.createObjectURL(f.blob);
  urlCache.set(fileId, url);
  return url;
}

/** Какой тип объекта предложить для выбранного файла. */
export function guessType(file: File): EntityType {
  const name = file.name.toLowerCase();
  if (file.type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (file.type.startsWith('image/')) return 'photo';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'voice';
  if (/\.(pptx?|key|odp)$/.test(name)) return 'presentation';
  if (/\.(epub|fb2|djvu)$/.test(name)) return 'book';
  return 'note';
}

export const formatSize = (n: number) =>
  n < 1024 ? `${n} Б` : n < 1024 ** 2 ? `${Math.round(n / 1024)} КБ` : `${(n / 1024 ** 2).toFixed(1)} МБ`;

/** Сколько места занято и доступно в пределах квоты браузера. */
export async function storageInfo(): Promise<{ usage?: number; quota?: number; persisted?: boolean }> {
  const s = navigator.storage;
  if (!s?.estimate) return {};
  const [est, persisted] = await Promise.all([s.estimate(), s.persisted?.() ?? Promise.resolve(undefined)]);
  return { usage: est.usage, quota: est.quota, persisted };
}

/** Попросить браузер не очищать данные Мастерской при нехватке места. */
export async function requestPersistence(): Promise<boolean> {
  return (await navigator.storage?.persist?.()) ?? false;
}
