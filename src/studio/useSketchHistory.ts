// Отмена и повтор для эскиза. История — снимки списка штрихов (штрихи неизменяемы,
// поэтому снимок дешёвый: копируется только массив ссылок).
import { useCallback, useRef, useState } from 'react';
import type { Stroke } from '../core/model/types';

const LIMIT = 200;

export function useSketchHistory(initial: Stroke[]) {
  const [strokes, setStrokes] = useState<Stroke[]>(initial);
  const undoStack = useRef<Stroke[][]>([]);
  const redoStack = useRef<Stroke[][]>([]);
  const [, bump] = useState(0);

  const commit = useCallback((next: Stroke[], prev: Stroke[]) => {
    undoStack.current.push(prev);
    if (undoStack.current.length > LIMIT) undoStack.current.shift();
    redoStack.current = [];
    setStrokes(next);
    bump((n) => n + 1);
  }, []);

  const undo = useCallback(() => {
    setStrokes((cur) => {
      const prev = undoStack.current.pop();
      if (!prev) return cur;
      redoStack.current.push(cur);
      return prev;
    });
    bump((n) => n + 1);
  }, []);

  const redo = useCallback(() => {
    setStrokes((cur) => {
      const next = redoStack.current.pop();
      if (!next) return cur;
      undoStack.current.push(cur);
      return next;
    });
    bump((n) => n + 1);
  }, []);

  const reset = useCallback((s: Stroke[]) => { undoStack.current = []; redoStack.current = []; setStrokes(s); bump((n) => n + 1); }, []);

  return { strokes, commit, undo, redo, reset, canUndo: undoStack.current.length > 0, canRedo: redoStack.current.length > 0 };
}
