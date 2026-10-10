// ЗАГЛУШКА ТОЛЬКО ДЛЯ ОФЛАЙН-СРЕДЫ РАЗРАБОТКИ (без доступа к npm).
// Реализует подмножество API Dexie 4, которое использует Мастерская:
//   class Db extends Dexie { t!: Table<T,string>; constructor(n){ super(n); this.version(1).stores({...}) } }
//   table.get/bulkGet/put/bulkPut/delete/bulkDelete/toArray/clear/count/where(i).equals(v)|anyOf(a).toArray()
//   db.transaction('rw', names, async (tx) => tx.table(name)...), db.table(name), db.tables
// В настоящей сборке (npm install && vite build) используется настоящий Dexie.
type Key = string;

const wrap = <T>(r: IDBRequest<T>) =>
  new Promise<T>((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

interface StoreDef { primKey: string; indexes: string[] }

export class Table<T, K = Key> {
  constructor(private db: Dexie, public readonly name: string, private tx?: IDBTransaction) {}

  private async store(mode: IDBTransactionMode): Promise<IDBObjectStore> {
    if (this.tx) return this.tx.objectStore(this.name);
    const idb = await this.db.idb();
    return idb.transaction(this.name, mode).objectStore(this.name);
  }

  async get(key: K): Promise<T | undefined> { return wrap((await this.store('readonly')).get(key as IDBValidKey)); }
  async bulkGet(keys: K[]): Promise<(T | undefined)[]> {
    const s = await this.store('readonly');
    return Promise.all(keys.map((k) => wrap(s.get(k as IDBValidKey))));
  }
  async put(v: T): Promise<K> { return wrap((await this.store('readwrite')).put(v)) as Promise<K>; }
  async bulkPut(vs: T[]): Promise<void> {
    const s = await this.store('readwrite');
    await Promise.all(vs.map((v) => wrap(s.put(v))));
  }
  async delete(k: K): Promise<void> { await wrap((await this.store('readwrite')).delete(k as IDBValidKey)); }
  async bulkDelete(ks: K[]): Promise<void> {
    const s = await this.store('readwrite');
    await Promise.all(ks.map((k) => wrap(s.delete(k as IDBValidKey))));
  }
  async toArray(): Promise<T[]> { return wrap((await this.store('readonly')).getAll()) as Promise<T[]>; }
  async clear(): Promise<void> { await wrap((await this.store('readwrite')).clear()); }
  async count(): Promise<number> { return wrap((await this.store('readonly')).count()); }
  where(index: string) {
    const all = async (vals: IDBValidKey[]) => {
      const s = await this.store('readonly');
      const src = index === s.keyPath ? s : s.index(index);
      const parts = await Promise.all(vals.map((v) => wrap(src.getAll(v))));
      return parts.flat() as T[];
    };
    return {
      equals: (v: IDBValidKey) => ({ toArray: () => all([v]) }),
      anyOf: (vs: IDBValidKey[]) => ({ toArray: () => all(vs) }),
    };
  }
}

export class Transaction {
  constructor(private db: Dexie, private tx: IDBTransaction) {}
  table<T = unknown>(name: string): Table<T> { return new Table<T>(this.db, name, this.tx); }
}

export default class Dexie {
  private defs: Record<string, StoreDef> = {};
  private ver = 0;
  private opening?: Promise<IDBDatabase>;
  tables: Table<unknown>[] = [];

  constructor(public readonly name: string) {}

  version(v: number) {
    this.ver = Math.max(this.ver, v);
    return {
      stores: (spec: Record<string, string>) => {
        for (const [name, s] of Object.entries(spec)) {
          const [pk, ...idx] = s.split(',').map((x) => x.trim()).filter(Boolean);
          this.defs[name] = { primKey: pk.replace(/^[&++]/, ''), indexes: idx.filter((i) => !i.startsWith('[')).map((i) => i.replace(/^[&*]/, '')) };
          const t = new Table(this, name);
          (this as unknown as Record<string, unknown>)[name] = t;
          this.tables = this.tables.filter((x) => x.name !== name).concat(t);
        }
        return this;
      },
    };
  }

  table<T = unknown>(name: string): Table<T> { return new Table<T>(this, name); }

  idb(): Promise<IDBDatabase> {
    if (!this.opening) {
      this.opening = new Promise((resolve, reject) => {
        const r = indexedDB.open(this.name, this.ver * 10);
        r.onupgradeneeded = () => {
          const db = r.result;
          for (const [name, d] of Object.entries(this.defs)) {
            const st = db.objectStoreNames.contains(name) ? r.transaction!.objectStore(name) : db.createObjectStore(name, { keyPath: d.primKey });
            for (const i of d.indexes) if (!st.indexNames.contains(i)) st.createIndex(i, i);
          }
        };
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
    }
    return this.opening;
  }

  async transaction<R>(_mode: 'rw' | 'r', names: string[], fn: (tx: Transaction) => Promise<R>): Promise<R> {
    const idb = await this.idb();
    const tr = idb.transaction(names, 'readwrite');
    const done = new Promise<void>((res, rej) => {
      tr.oncomplete = () => res();
      tr.onerror = () => rej(tr.error);
      tr.onabort = () => rej(tr.error ?? new Error('aborted'));
    });
    try {
      const out = await fn(new Transaction(this, tr));
      await done;
      return out;
    } catch (e) {
      try { tr.abort(); } catch { /* already finished */ }
      throw e;
    }
  }

  close() { this.opening?.then((d) => d.close()); this.opening = undefined; }
}
