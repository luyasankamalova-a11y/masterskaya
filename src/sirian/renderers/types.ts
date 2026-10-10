// Интерфейс рендерера Сириана. Реализации:
//  • StaticImageRenderer — этап 0: позы из канонического референса + спокойное CSS-дыхание и свечение
//  • SpriteRenderer      — позже: отдельные позы и короткие анимации
//  • RiveRenderer        — позже: интерактивный персонаж
// Любая реализация обязана соблюдать канон (sirian/canon.ts).
import type { SirianState } from '../controller';

export interface SirianRendererProps {
  state: SirianState;
  variant: 'avatar' | 'portrait';
  size?: number;
}
