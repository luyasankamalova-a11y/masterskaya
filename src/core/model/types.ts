// Модель данных Мастерской. Источник истины: архитектурный документ, раздел 4.
// Всё в приложении — это сущности (Entity) и связи (Relation) между ними.
// Позиция сущности на конкретной карте хранится отдельно (Placement),
// поэтому один объект может стоять на многих картах без копирования.

export type ID = string;

/** Служебные поля любой записи — готовность к синхронизации с первого дня. */
export interface Base {
  id: ID;
  createdAt: number;
  updatedAt: number;
  /** Мягкое удаление: запись остаётся как «надгробие», чтобы синхронизация не воскресила её. */
  deletedAt?: number;
  /** Номер изменения записи; растёт при каждом commit(). */
  rev: number;
}

export type EntityType =
  | 'discipline' | 'topic' | 'assignment'
  | 'research' | 'project' | 'idea' | 'note' | 'question'
  | 'book' | 'pdf' | 'presentation' | 'video' | 'article' | 'podcast' | 'link'
  | 'object' | 'sketch' | 'photo' | 'voice' | 'inspiration';

export interface FileRef {
  fileId: ID;
  name: string;
  mime: string;
  size: number;
  storage: 'local' | 'cloud';
}

export interface Entity extends Base {
  type: EntityType;
  title: string;
  description?: string;
  /** Текст заметки. Позже — структурированный rich text. */
  body?: string;
  /** Статус зависит от типа (понимание темы, статус задания…). Необязателен. */
  status?: string;
  /** Поля конкретного типа: срок задания, координаты объекта, причина сохранения… */
  meta: Record<string, unknown>;
  tags: string[];
  attachments: FileRef[];
  /** 🔒 «Не использовать AI»: такие объекты не попадают в контекст Сириана. */
  aiAccess: 'allowed' | 'blocked';
  archivedAt?: number;
}

export type RelationKind =
  | 'studying' | 'researching' | 'example' | 'drew' | 'using' | 'idea' | 'source' | 'question'
  | 'grew_from' | 'part_of';

export interface Relation extends Base {
  /** Направление читается как «from [kind] to»: Project —grew_from→ Idea. */
  fromId: ID;
  toId: ID;
  kind?: RelationKind;
  note?: string;
  origin: 'user' | 'sirian_accepted' | 'system';
}

export type SpaceKind =
  | 'world' | 'home' | 'campus' | 'discipline' | 'research-hub' | 'research'
  | 'objects' | 'library' | 'studio' | 'projects' | 'project' | 'inspiration' | 'path';

export interface Viewport { x: number; y: number; zoom: number }

export interface Space extends Base {
  kind: SpaceKind;
  title: string;
  /** Хозяин карты: дисциплина, исследование или проект. У системных карт отсутствует. */
  ownerEntityId?: ID;
  viewport: Viewport;
}

export interface Placement extends Base {
  spaceId: ID;
  entityId: ID;
  x: number;
  y: number;
  w?: number;
  h?: number;
  groupId?: ID;
}

export type EventType =
  | 'entity.created' | 'entity.updated' | 'entity.deleted' | 'entity.archived' | 'entity.restored'
  | 'relation.created' | 'relation.deleted'
  | 'status.changed' | 'project.grown' | 'version.created';

/** Журнал: только дописывается. Из него строятся «Что растёт?» и «Мой путь». */
export interface AppEvent {
  id: ID;
  at: number;
  type: EventType;
  entityId?: ID;
  relationId?: ID;
  data?: Record<string, unknown>;
}

export type ProposalKind = 'link' | 'regroup' | 'save' | 'to_project' | 'edit_sketch';

/** Всё, что предлагает Сириан. Данные меняются только после «Применить». */
export interface Proposal {
  id: ID;
  kind: ProposalKind;
  payload: Record<string, unknown>;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: number;
}

/** Штрих эскиза: точки [x, y, нажим 0..1]. */
export interface Stroke {
  id: ID;
  kind: 'stroke';
  tool: 'pen' | 'pencil';
  color: string;
  size: number;
  points: [number, number, number][];
  layerId: ID;
}

/** Эскиз хранится как редактируемая структура: слои и элементы, а не картинка. */
export interface SketchDoc {
  entityId: ID;
  /** В этапе 0 один слой «Рисунок»; полноценные слои — этап 2. */
  layers: { id: ID; name: string; visible: boolean; locked: boolean }[];
  elements: Stroke[];
  updatedAt: number;
  rev?: number;
}

export interface Version {
  id: ID;
  entityId: ID;
  label: string;
  snapshot: unknown;
  note?: string;
  createdAt: number;
}

export interface StoredFile {
  id: ID;
  blob: Blob;
  name: string;
  mime: string;
  size: number;
  createdAt: number;
}

export interface FileChunk {
  id: ID;
  fileId: ID;
  entityId: ID;
  page?: number;
  text: string;
}

/** Очередь изменений для будущей синхронизации. */
export interface OutboxItem {
  id: ID;
  table: string;
  recordId: ID;
  op: 'put' | 'delete';
  at: number;
}
