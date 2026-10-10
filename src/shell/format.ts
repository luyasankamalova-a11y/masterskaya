// Подписи и форматирование для интерфейса.
import { useEffect, useState } from 'react';
import type { Entity } from '../core/model/types';
import { typeDef } from '../core/registry/entityTypes';
import { fileUrl } from '../files/fileStore';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** Срок задания — просто информация: «до 18 октября». Без отсчёта и предупреждений. */
export function dueLabel(iso: unknown): string | null {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [y, m, d] = iso.split('-').map(Number);
  const thisYear = new Date().getFullYear();
  return `до ${d} ${MONTHS[m - 1]}${y !== thisYear ? ` ${y}` : ''}`;
}

export function statusOf(e: Entity) {
  return typeDef(e.type).statuses?.find((s) => s.id === e.status);
}

export const icon = (e: Pick<Entity, 'type'>) => typeDef(e.type).icon;

export function dateLabel(ts: number): string {
  const d = new Date(ts);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** URL первой картинки объекта (для превью фото и вдохновения). */
export function useImageUrl(e: Entity): string | undefined {
  const img = e.attachments.find((a) => a.mime.startsWith('image/'));
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    let alive = true;
    if (img) fileUrl(img.fileId).then((u) => alive && setUrl(u));
    else setUrl(undefined);
    return () => { alive = false; };
  }, [img?.fileId]);
  return url;
}
