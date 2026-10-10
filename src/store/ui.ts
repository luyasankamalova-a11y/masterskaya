// Состояние интерфейса (Zustand). Данные Мастерской здесь НЕ хранятся —
// они живут в IndexedDB и читаются живыми запросами (useLive).
import { create } from 'zustand';
import type { ID, Relation } from '../core/model/types';

export type Sheet =
  | { kind: 'add'; spaceId?: ID; at?: { x: number; y: number }; presetType?: string }
  | { kind: 'search' }
  | { kind: 'settings' }
  | { kind: 'sections' }
  | { kind: 'link'; fromId: ID }
  | { kind: 'grow'; ideaId: ID }
  | { kind: 'sirian' }
  | null;

export interface ContextMenuState {
  entityId: ID;
  placementId?: ID;
  spaceId?: ID;
  x: number;
  y: number;
}

interface UIState {
  sheet: Sheet;
  /** Открытая карточка объекта. */
  panelId: ID | null;
  menu: ContextMenuState | null;
  /** Связь только что создана — предложить выбрать её тип. */
  justLinked: Relation | null;
  /** Режим «соедини с…»: следующий выбранный узел станет концом связи. */
  connectFrom: ID | null;
  /** «Чистое пространство»: минимум интерфейса. */
  clean: boolean;
  toast: string | null;
  open: (s: Sheet) => void;
  close: () => void;
  showPanel: (id: ID | null) => void;
}

export const useUI = create<UIState>()((set) => ({
  sheet: null,
  panelId: null,
  menu: null,
  justLinked: null,
  connectFrom: null,
  clean: false,
  toast: null,
  open: (sheet) => set({ sheet, menu: null }),
  close: () => set({ sheet: null }),
  showPanel: (panelId) => set({ panelId, menu: null }),
}));

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(text: string) {
  useUI.setState({ toast: text });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => useUI.setState({ toast: null }), 2800);
}
