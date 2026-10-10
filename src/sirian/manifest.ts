// Манифест графики: состояние → изображение.
// Замена картинок на позы, спрайты или анимацию = новый манифест и рендерер,
// контроллер и характер при этом не меняются.
import type { Mood, Pose } from './controller';

export interface SirianAssets {
  portrait: string;
  faces: Record<Mood, string>;
  flying: string;
  scenes: { study: string; research: string; project: string; inspire: string; near: string };
}

const base = './sirian/';

export const STATIC_MANIFEST: SirianAssets = {
  portrait: base + 'perched.jpg',
  faces: { calm: base + 'face-main.jpg', curious: base + 'face-curious.jpg', playful: base + 'face-playful.jpg', serious: base + 'face-serious.jpg' },
  flying: base + 'flying.jpg',
  scenes: { study: base + 'study.jpg', research: base + 'research.jpg', project: base + 'project.jpg', inspire: base + 'inspire.jpg', near: base + 'near.jpg' },
};

/** Какое лицо показать в «присаде» для данной позы. */
export function faceFor(pose: Pose, mood: Mood): Mood {
  if (pose === 'thinking') return 'serious';
  if (pose === 'listening') return 'curious';
  return mood;
}
