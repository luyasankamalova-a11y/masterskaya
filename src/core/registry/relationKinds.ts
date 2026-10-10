// Типы связей. Тип необязателен: связь без типа — нормальная связь.
import type { RelationKind } from '../model/types';

export interface RelationKindDef {
  kind: RelationKind;
  icon: string;
  label: string;
  /** Системные типы не предлагаются в меню выбора. */
  system?: boolean;
}

export const RELATION_KINDS: RelationKindDef[] = [
  { kind: 'studying', icon: '📚', label: 'Изучаю' },
  { kind: 'researching', icon: '🔎', label: 'Исследую' },
  { kind: 'example', icon: '🏛️', label: 'Пример' },
  { kind: 'drew', icon: '📐', label: 'Нарисовала' },
  { kind: 'using', icon: '🏗️', label: 'Использую' },
  { kind: 'idea', icon: '💡', label: 'Идея' },
  { kind: 'source', icon: '📖', label: 'Источник' },
  { kind: 'question', icon: '❓', label: 'Хочу разобраться' },
  { kind: 'grew_from', icon: '🌱', label: 'Вырос из', system: true },
  { kind: 'part_of', icon: '◦', label: 'Входит в', system: true },
];

export const relationDef = (k?: RelationKind) => RELATION_KINDS.find((d) => d.kind === k);
