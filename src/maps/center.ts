// Центр видимой части текущей карты — сюда «＋» кладёт новый объект.
let current: { spaceId: string; x: number; y: number } | null = null;

export function setMapCenter(spaceId: string, pt: { x: number; y: number }) {
  current = { spaceId, ...pt };
}

/** Центр видимой части карты (если открыта именно эта карта). */
export function viewCenter(spaceId: string): { x: number; y: number } | undefined {
  return current && current.spaceId === spaceId ? { x: current.x, y: current.y } : undefined;
}
