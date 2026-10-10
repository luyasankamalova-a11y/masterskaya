import { faceFor, STATIC_MANIFEST } from '../manifest';
import type { SirianRendererProps } from './types';

/** Этап 0: изображения из канонического референса + спокойная CSS-жизнь (дыхание, свечение). */
export function StaticImageRenderer({ state, variant, size = 64 }: SirianRendererProps) {
  const src = variant === 'portrait'
    ? (state.pose === 'flying' || state.pose === 'flame' ? STATIC_MANIFEST.flying : STATIC_MANIFEST.portrait)
    : STATIC_MANIFEST.faces[faceFor(state.pose, state.mood)];
  return (
    <div
      className={`sirian sirian--${variant} sirian--${state.pose} sirian-tint--${state.tint}`}
      style={variant === 'avatar' ? { width: size, height: size } : undefined}
      aria-label="Сириан"
      role="img"
    >
      <img src={src} alt="" draggable={false} />
      <span className="sirian__glow" />
      <span className="sirian__stars" />
    </div>
  );
}
