// Контроллер Сириана: машина состояний, независимая от графики.
// Рендерер получает только состояние — логика и характер не зависят от того,
// картинка это, спрайт, Rive или 3D-персонаж.
import { create } from 'zustand';
import type { SpaceKind } from '../core/model/types';

export type Pose = 'perched' | 'listening' | 'thinking' | 'speaking' | 'flying' | 'flame';
export type Mood = 'calm' | 'curious' | 'playful' | 'serious';
/** Тонкий оттенок по пространству. */
export type Tint = 'neutral' | 'campus' | 'research' | 'library' | 'studio' | 'project' | 'inspiration' | 'path';

export interface SirianState {
  pose: Pose;
  mood: Mood;
  tint: Tint;
  /** Тихий индикатор «у меня есть мысль». Сириан сам не заговаривает. */
  hasThought: boolean;
}

export const useSirian = create<SirianState>()(() => ({ pose: 'perched', mood: 'calm', tint: 'neutral', hasThought: false }));

const TINTS: Partial<Record<SpaceKind, Tint>> = {
  campus: 'campus', discipline: 'campus', 'research-hub': 'research', research: 'research',
  library: 'library', studio: 'studio', projects: 'project', project: 'project', inspiration: 'inspiration', path: 'path',
};

const set = useSirian.setState;

export const sirian = {
  setContext(kind: SpaceKind | 'world') { set({ tint: (kind !== 'world' && TINTS[kind]) || 'neutral' }); },
  listen() { set({ pose: 'listening', mood: 'curious' }); },
  think() { set({ pose: 'thinking', mood: 'serious' }); },
  speak(mood: Mood = 'calm') { set({ pose: 'speaking', mood }); },
  rest() { set({ pose: 'perched', mood: 'calm' }); },
  setThought(v: boolean) { if (useSirian.getState().hasThought !== v) set({ hasThought: v }); },
  /** Особый момент (например, идея стала проектом): короткий взлёт со свечением. */
  flare() {
    set({ pose: 'flame' });
    setTimeout(() => set({ pose: 'perched' }), 2200);
  },
};
