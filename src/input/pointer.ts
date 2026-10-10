// Единый слой ввода: палец, стилус, мышь.
// - стилус (pointerType 'pen') — рисование и соединение;
// - палец — перемещение, два пальца — масштаб;
// - отсечение ладони: пока стилус активен или был активен недавно, касания пальцем игнорируются.
import type { PointerEvent as RPointerEvent } from 'react';

type AnyPointer = PointerEvent | RPointerEvent;

export const LONG_PRESS_MS = 520;
export const DOUBLE_TAP_MS = 320;
export const MOVE_SLOP = 7;
const PALM_GRACE_MS = 400;

let penActiveUntil = 0;
let penDown = false;
let penSeen = false;

/** Регистрирует активность стилуса (вызывается на любом pointer-событии). */
export function notePointer(e: AnyPointer, phase: 'down' | 'move' | 'up') {
  if (e.pointerType !== 'pen') return;
  penSeen = true;
  if (phase === 'down') penDown = true;
  if (phase === 'up') penDown = false;
  penActiveUntil = performance.now() + PALM_GRACE_MS;
}

/** Касание пальцем во время работы стилуса — скорее всего ладонь. */
export function isPalm(e: AnyPointer): boolean {
  return e.pointerType === 'touch' && (penDown || performance.now() < penActiveUntil);
}

/** Видели ли мы стилус на этом устройстве — тогда палец в Студии не рисует, а двигает холст. */
export const hasSeenPen = () => penSeen;

export const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
