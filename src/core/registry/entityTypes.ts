// Реестр типов объектов. Новый тип = новая запись здесь;
// база, связи, поиск и карты подхватывают его без изменений.
import type { EntityType, SpaceKind } from '../model/types';


export interface StatusOption { id: string; label: string; color: string }

export interface MetaField {
  key: string;
  label: string;
  kind: 'text' | 'date' | 'select' | 'longtext' | 'url';
  options?: { id: string; label: string }[];
  placeholder?: string;
}

export interface EntityTypeDef {
  type: EntityType;
  icon: string;
  label: string;
  /** Есть ли у объекта своя карта (дисциплина, исследование, проект). */
  ownSpace?: SpaceKind;
  statuses?: StatusOption[];
  metaFields?: MetaField[];
  /** Материал: попадает в Библиотеку. */
  isMaterial?: boolean;
  /** Подсказка в поле названия при создании. */
  titlePrompt?: string;
}

export const UNDERSTANDING: StatusOption[] = [
  { id: 'not_studied', label: 'Не изучала', color: 'var(--st-0)' },
  { id: 'studying', label: 'Изучаю', color: 'var(--st-1)' },
  { id: 'understand', label: 'Понимаю', color: 'var(--st-2)' },
  { id: 'can_explain', label: 'Могу объяснить', color: 'var(--st-3)' },
  { id: 'applied', label: 'Применяла', color: 'var(--st-4)' },
];

const SAVE_REASON: MetaField = {
  key: 'reason', label: 'Почему сохраняю', kind: 'select',
  options: [
    { id: 'study', label: 'Учёба' }, { id: 'research', label: 'Исследование' },
    { id: 'project', label: 'Проект' }, { id: 'inspiration', label: 'Вдохновение' },
    { id: 'curious', label: 'Просто интересно' },
  ],
};

export const ENTITY_TYPES: Record<EntityType, EntityTypeDef> = {
  discipline: { type: 'discipline', icon: '🎓', label: 'Дисциплина', ownSpace: 'discipline', titlePrompt: 'Например, Механика грунтов' },
  topic: { type: 'topic', icon: '🪨', label: 'Тема', statuses: UNDERSTANDING, titlePrompt: 'Например, Основания' },
  assignment: {
    type: 'assignment', icon: '📝', label: 'Задание',
    statuses: [
      { id: 'open', label: 'В работе', color: 'var(--st-1)' },
      { id: 'submitted', label: 'Сдано', color: 'var(--st-3)' },
      { id: 'done', label: 'Закрыто', color: 'var(--st-4)' },
    ],
    metaFields: [
      { key: 'assignmentKind', label: 'Вид', kind: 'select', options: [
        { id: 'homework', label: 'Домашнее задание' }, { id: 'practical', label: 'Практическая работа' },
        { id: 'lab', label: 'Лабораторная' }, { id: 'calc', label: 'Расчётная' },
        { id: 'self', label: 'Самостоятельная работа' }, { id: 'coursework', label: 'Курсовая' },
        { id: 'project', label: 'Учебный проект' }, { id: 'other', label: 'Другое' },
      ] },
      // Срок — просто информация: показывается тихо, без отсчёта и предупреждений.
      { key: 'dueDate', label: 'Срок', kind: 'date' },
      { key: 'teacherComment', label: 'Комментарий преподавателя', kind: 'longtext' },
      { key: 'grade', label: 'Оценка', kind: 'text' },
    ],
  },
  research: { type: 'research', icon: '🔎', label: 'Исследование', ownSpace: 'research', titlePrompt: 'Что тебе интересно узнать?' },
  project: { type: 'project', icon: '🏗️', label: 'Проект', ownSpace: 'project', titlePrompt: 'Название проекта' },
  idea: { type: 'idea', icon: '💡', label: 'Идея', titlePrompt: 'Маленькая идея' },
  note: { type: 'note', icon: '📝', label: 'Заметка' },
  question: { type: 'question', icon: '❓', label: 'Вопрос', titlePrompt: 'Что хочется понять?' },
  book: { type: 'book', icon: '📕', label: 'Книга', isMaterial: true, metaFields: [SAVE_REASON] },
  pdf: { type: 'pdf', icon: '📄', label: 'PDF', isMaterial: true, metaFields: [SAVE_REASON] },
  presentation: { type: 'presentation', icon: '📊', label: 'Презентация', isMaterial: true, metaFields: [SAVE_REASON] },
  video: { type: 'video', icon: '🎬', label: 'Видео', isMaterial: true, metaFields: [{ key: 'url', label: 'Ссылка', kind: 'url' }, SAVE_REASON] },
  article: { type: 'article', icon: '📰', label: 'Статья', isMaterial: true, metaFields: [{ key: 'url', label: 'Ссылка', kind: 'url' }, SAVE_REASON] },
  podcast: { type: 'podcast', icon: '🎧', label: 'Подкаст', isMaterial: true, metaFields: [{ key: 'url', label: 'Ссылка', kind: 'url' }, SAVE_REASON] },
  link: { type: 'link', icon: '🔗', label: 'Ссылка', isMaterial: true, metaFields: [{ key: 'url', label: 'Адрес', kind: 'url' }, SAVE_REASON] },
  object: {
    type: 'object', icon: '🏛️', label: 'Объект',
    metaFields: [
      { key: 'place', label: 'Местоположение', kind: 'text', placeholder: 'Город, страна' },
      { key: 'structureKind', label: 'Тип сооружения', kind: 'text', placeholder: 'Мост, тоннель, здание…' },
      { key: 'why', label: 'Почему сохранила', kind: 'longtext' },
    ],
  },
  sketch: { type: 'sketch', icon: '✏️', label: 'Эскиз' },
  photo: { type: 'photo', icon: '📷', label: 'Фото' },
  voice: { type: 'voice', icon: '🎙️', label: 'Голосовая заметка' },
  inspiration: {
    type: 'inspiration', icon: '✨', label: 'Вдохновение',
    metaFields: [{ key: 'whyLiked', label: 'Почему мне это понравилось?', kind: 'longtext' }],
  },
};

export const typeDef = (t: EntityType): EntityTypeDef => ENTITY_TYPES[t];
export const MATERIAL_TYPES: EntityType[] = Object.values(ENTITY_TYPES).filter((d) => d.isMaterial).map((d) => d.type);
export const isMaterial = (t: EntityType) => !!ENTITY_TYPES[t].isMaterial;
/** Типы, для которых нужен файл при создании. */
export const FILE_TYPES: EntityType[] = ['pdf', 'presentation', 'photo', 'book'];
/** Типы, для которых естественна ссылка. */
export const URL_TYPES: EntityType[] = ['video', 'article', 'podcast', 'link'];
