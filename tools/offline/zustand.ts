// ЗАГЛУШКА ТОЛЬКО ДЛЯ ОФЛАЙН-СРЕДЫ РАЗРАБОТКИ. Подмножество API zustand 5:
//   const useX = create<State>()((set, get) => ({...}));  useX(selector); useX.getState(); useX.setState(); useX.subscribe()
import { useSyncExternalStore } from 'react';

type SetState<T> = (partial: Partial<T> | ((s: T) => Partial<T>)) => void;

export interface StoreApi<T> {
  getState: () => T;
  setState: SetState<T>;
  subscribe: (fn: (s: T, prev: T) => void) => () => void;
}

export type UseBoundStore<T> = {
  (): T;
  <U>(selector: (s: T) => U): U;
} & StoreApi<T>;

export function create<T>() {
  return (init: (set: SetState<T>, get: () => T, api: StoreApi<T>) => T): UseBoundStore<T> => {
    let state: T;
    const subs = new Set<(s: T, p: T) => void>();
    const api: StoreApi<T> = {
      getState: () => state,
      setState: (partial) => {
        const p = typeof partial === 'function' ? (partial as (s: T) => Partial<T>)(state) : partial;
        const prev = state;
        state = { ...state, ...p };
        subs.forEach((f) => f(state, prev));
      },
      subscribe: (fn) => { subs.add(fn); return () => { subs.delete(fn); }; },
    };
    state = init(api.setState, api.getState, api);
    const hook = (<U>(selector?: (s: T) => U) =>
      useSyncExternalStore(api.subscribe, () => (selector ? selector(state) : state))) as UseBoundStore<T>;
    Object.assign(hook, api);
    return hook;
  };
}
