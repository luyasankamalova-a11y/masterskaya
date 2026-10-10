// Локальная база Мастерской: Dexie поверх IndexedDB.
// Работает в пределах квоты браузера/устройства. При изменении схемы —
// добавить this.version(N+1).stores({...}) с описанием перехода; старые данные сохраняются.
import Dexie, { type Table } from 'dexie';
import type {
  AppEvent, Entity, FileChunk, OutboxItem, Placement, Proposal, Relation, SketchDoc, Space, StoredFile, Version,
} from '../model/types';

export const SCHEMA_VERSION = 1;

export interface MetaRow { key: string; value: unknown }

export class MasterskayaDB extends Dexie {
  entities!: Table<Entity, string>;
  relations!: Table<Relation, string>;
  spaces!: Table<Space, string>;
  placements!: Table<Placement, string>;
  events!: Table<AppEvent, string>;
  proposals!: Table<Proposal, string>;
  sketches!: Table<SketchDoc, string>;
  versions!: Table<Version, string>;
  files!: Table<StoredFile, string>;
  fileChunks!: Table<FileChunk, string>;
  outbox!: Table<OutboxItem, string>;
  meta!: Table<MetaRow, string>;

  constructor(name: string) {
    super(name);
    this.version(SCHEMA_VERSION).stores({
      entities: 'id, type',
      relations: 'id, fromId, toId',
      spaces: 'id, ownerEntityId, kind',
      placements: 'id, spaceId, entityId',
      events: 'id, entityId, type',
      proposals: 'id, status',
      sketches: 'entityId',
      versions: 'id, entityId',
      files: 'id',
      fileChunks: 'id, entityId, fileId',
      outbox: 'id',
      meta: 'key',
    });
  }
}

export const TABLES = [
  'entities', 'relations', 'spaces', 'placements', 'events', 'proposals',
  'sketches', 'versions', 'files', 'fileChunks', 'outbox', 'meta',
] as const;
export type TableName = (typeof TABLES)[number];

/** Режим данных: реальная Мастерская или отдельная демо-база. */
export type DataMode = 'real' | 'demo';
const MODE_KEY = 'masterskaya.mode';

export function currentMode(): DataMode {
  try { return localStorage.getItem(MODE_KEY) === 'demo' ? 'demo' : 'real'; } catch { return 'real'; }
}

export function setMode(mode: DataMode) {
  try { localStorage.setItem(MODE_KEY, mode); } catch { /* приватный режим браузера */ }
}

export const dbName = (mode: DataMode) => (mode === 'demo' ? 'masterskaya-demo' : 'masterskaya');

export const db = new MasterskayaDB(dbName(currentMode()));
