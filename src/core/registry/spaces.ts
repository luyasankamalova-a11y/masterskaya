// Системные пространства — области мира. Создаются один раз и остаются пустыми,
// пока пользователь сама ничего туда не положит.
import type { EntityType, SpaceKind } from '../model/types';

export interface AreaDef {
  kind: SpaceKind;
  /** Постоянный id системного пространства. */
  id: string;
  icon: string;
  title: string;
  hint: string;
  /** Положение области на карте мира (доли ширины и высоты). */
  at: { x: number; y: number };
  /** Что предлагать в «＋» внутри области. */
  addTypes: EntityType[];
  /** Чем область отличается от обычной карты (или почему её карта пока не готова). */
  note?: string;
}

export const WORLD_ID = 'space:world';
export const HOME_ID = 'space:home';
export const CAMPUS_ID = 'space:campus';
export const RESEARCH_ID = 'space:research';
export const OBJECTS_ID = 'space:objects';
export const LIBRARY_ID = 'space:library';
export const STUDIO_ID = 'space:studio';
export const PROJECTS_ID = 'space:projects';
export const INSPIRATION_ID = 'space:inspiration';
export const PATH_ID = 'space:path';

const MATERIALS: EntityType[] = ['book', 'pdf', 'presentation', 'video', 'article', 'podcast', 'link', 'note'];

export const AREAS: AreaDef[] = [
  { kind: 'home', id: HOME_ID, icon: '🏠', title: 'Моя мастерская', hint: 'чем я сейчас живу', at: { x: 0.5, y: 0.5 }, addTypes: ['idea', 'question', 'note', 'research', 'project', 'photo', 'sketch'] },
  { kind: 'campus', id: CAMPUS_ID, icon: '🎓', title: 'Вуз', hint: 'дисциплины, темы, задания', at: { x: 0.22, y: 0.27 }, addTypes: ['discipline'] },
  { kind: 'research-hub', id: RESEARCH_ID, icon: '🔎', title: 'Исследования', hint: 'что хочу понять', at: { x: 0.76, y: 0.24 }, addTypes: ['research'] },
  { kind: 'objects', id: OBJECTS_ID, icon: '🏛️', title: 'Объекты', hint: 'реальные сооружения', at: { x: 0.87, y: 0.56 }, addTypes: ['object'], note: 'Географическая карта мира появится на этапе 3. Пока объекты лежат на обычной карте.' },
  { kind: 'library', id: LIBRARY_ID, icon: '📚', title: 'Библиотека', hint: 'карта материалов', at: { x: 0.13, y: 0.6 }, addTypes: MATERIALS },
  { kind: 'studio', id: STUDIO_ID, icon: '📐', title: 'Студия', hint: 'чертёжный стол', at: { x: 0.36, y: 0.82 }, addTypes: ['sketch'] },
  { kind: 'projects', id: PROJECTS_ID, icon: '🏗️', title: 'Проекты', hint: 'то, что я строю', at: { x: 0.64, y: 0.8 }, addTypes: ['project'] },
  { kind: 'inspiration', id: INSPIRATION_ID, icon: '💡', title: 'Вдохновение', hint: 'визуальный мир', at: { x: 0.45, y: 0.13 }, addTypes: ['inspiration', 'photo', 'idea'] },
  { kind: 'path', id: PATH_ID, icon: '🧭', title: 'Мой путь', hint: 'поняла, применила, создала', at: { x: 0.9, y: 0.88 }, addTypes: [], note: 'Карта пути строится из журнала событий — этап 6. Журнал ведётся уже сейчас, история не потеряется.' },
];

export const areaById = (id: string) => AREAS.find((a) => a.id === id);

/** Что предлагать в «＋» на собственной карте объекта. */
export const OWN_SPACE_ADD: Partial<Record<SpaceKind, EntityType[]>> = {
  discipline: ['topic', 'assignment', 'pdf', 'presentation', 'photo', 'link', 'video', 'note', 'question'],
  research: ['question', 'idea', 'note', 'pdf', 'book', 'article', 'link', 'video', 'object', 'sketch', 'photo'],
  project: ['idea', 'research', 'note', 'question', 'sketch', 'pdf', 'object', 'photo', 'link'],
};

/**
 * Куда положить объект, созданный без контекста (из карты мира или поиска).
 * Материалы без места не кладутся никуда — они попадают в «Неразобранное».
 */
export function defaultAreaFor(type: EntityType): string | undefined {
  switch (type) {
    case 'discipline': return CAMPUS_ID;
    case 'research': return RESEARCH_ID;
    case 'project': return PROJECTS_ID;
    case 'object': return OBJECTS_ID;
    case 'inspiration': return INSPIRATION_ID;
    case 'sketch': return STUDIO_ID;
    case 'idea': case 'question': case 'note': case 'photo': case 'voice': return HOME_ID;
    default: return undefined; // материалы → «Неразобранное»
  }
}

/** Визуальный характер карты. */
export const SPACE_THEME: Record<SpaceKind, string> = {
  world: 'world', home: 'home', campus: 'campus', discipline: 'campus', 'research-hub': 'research',
  research: 'research', objects: 'objects', library: 'library', studio: 'studio', projects: 'project',
  project: 'project', inspiration: 'inspiration', path: 'path',
};
