// Простой поиск, работает офлайн. Смысловой и разговорный поиск подключатся
// через SemanticSearch, когда появится AI (этап 4).
import type { Entity } from '../core/model/types';
import { allEntities } from '../core/repo/queries';
import { typeDef } from '../core/registry/entityTypes';

export interface SearchHit { entity: Entity; score: number; why: string }

export interface SemanticSearch {
  search(query: string): Promise<SearchHit[]>;
}

const norm = (s: string) => s.toLowerCase().replaceAll('ё', 'е');

/** Грубый стемминг: срезаем частые русские окончания, чтобы «фундаменты» находили «фундамент». */
const stem = (w: string) => (w.length > 5 ? w.replace(/(ами|ями|ов|ев|ей|ах|ях|ом|ем|ой|ий|ый|ая|ое|ые|ы|и|а|я|у|ю|е|о)$/u, '') : w);

export async function keywordSearch(query: string, limit = 30): Promise<SearchHit[]> {
  const words = norm(query).split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1).map(stem);
  if (!words.length) return [];
  const hits: SearchHit[] = [];
  for (const e of await allEntities(true)) {
    const fields: [string, string, number][] = [
      ['название', e.title, 5],
      ['описание', e.description ?? '', 2],
      ['заметка', e.body ?? '', 1],
      ['метки', e.tags.join(' '), 3],
      ['тип', typeDef(e.type).label, 1],
      ['поля', Object.values(e.meta).filter((v) => typeof v === 'string').join(' '), 1],
    ];
    let score = 0;
    const why = new Set<string>();
    for (const w of words) {
      for (const [label, text, weight] of fields) {
        if (text && norm(text).includes(w)) { score += weight; why.add(label); }
      }
    }
    if (score) hits.push({ entity: e, score: score - (e.archivedAt ? 1 : 0), why: [...why].join(', ') });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
