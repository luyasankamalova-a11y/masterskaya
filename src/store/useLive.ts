// Живой запрос: перечитывает данные, когда commit() меняет связанные хранилища.
import { useEffect, useRef, useState } from 'react';
import { onChange } from '../core/repo/bus';

export function useLive<T>(query: () => Promise<T>, deps: unknown[], tables?: string[]): T | undefined {
  const [value, setValue] = useState<T>();
  const q = useRef(query);
  q.current = query;
  useEffect(() => {
    let alive = true;
    let seq = 0;
    const run = () => {
      const my = ++seq;
      q.current().then((v) => { if (alive && my === seq) setValue(v); }).catch((e) => console.error(e));
    };
    run();
    const off = onChange((changed) => {
      if (!tables || tables.some((t) => changed.has(t))) run();
    });
    return () => { alive = false; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return value;
}
