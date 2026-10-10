// Шина изменений: commit() сообщает, какие хранилища изменились,
// живые запросы интерфейса перечитывают только то, что их касается.
type Listener = (tables: Set<string>) => void;

const listeners = new Set<Listener>();

export function onChange(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitChange(tables: Iterable<string>) {
  const set = new Set(tables);
  listeners.forEach((fn) => fn(set));
}
