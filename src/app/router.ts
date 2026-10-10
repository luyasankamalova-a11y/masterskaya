// Маршруты на hash: работают на GitHub Pages и Netlify без настройки сервера.
//   #/            — Мир
//   #/s/:spaceId  — карта пространства (системного или собственной карты объекта)
//   #/d/:entityId — эскиз в Студии
import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'world' }
  | { name: 'space'; id: string }
  | { name: 'sketch'; id: string };

function parse(hash: string): Route {
  const [, kind, id] = hash.replace(/^#/, '').split('/');
  if (kind === 's' && id) return { name: 'space', id: decodeURIComponent(id) };
  if (kind === 'd' && id) return { name: 'sketch', id: decodeURIComponent(id) };
  return { name: 'world' };
}

const href = (r: Route) =>
  r.name === 'world' ? '#/' : `#/${r.name === 'space' ? 's' : 'd'}/${encodeURIComponent(r.id)}`;

let current = parse(location.hash);
const subs = new Set<() => void>();
window.addEventListener('hashchange', () => {
  current = parse(location.hash);
  subs.forEach((f) => f());
});

export const useRoute = () =>
  useSyncExternalStore((f) => { subs.add(f); return () => { subs.delete(f); }; }, () => current);

let depth = 0;

export function go(r: Route) {
  const h = href(r);
  if (location.hash === h) return;
  depth++;
  location.hash = h;
}

/** Назад внутри Мастерской; если истории нет — в Мир. */
export function back() {
  if (depth > 0) { depth--; history.back(); } else go({ name: 'world' });
}
