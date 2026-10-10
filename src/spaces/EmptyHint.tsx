// Пустая карта — приглашение к действию, а не пустота.
import type { Entity, Space } from '../core/model/types';
import { useUI } from '../store/ui';

const HINTS: Record<string, { text: string; action: string }> = {
  home: { text: 'Здесь будет то, чем ты сейчас живёшь: идеи, вопросы, исследования, эскизы.', action: 'Положить первую мысль' },
  campus: { text: 'Кампус пока пуст. Дисциплины появляются только те, что добавишь ты.', action: 'Добавить дисциплину' },
  discipline: { text: 'Карта дисциплины. Темы, задания и материалы — в любом порядке.', action: 'Добавить тему или задание' },
  'research-hub': { text: 'С чего начинается исследование? С вопроса.', action: 'Что тебе интересно узнать?' },
  research: { text: 'Разложи вопрос на направления: геология, вода, конструкции, примеры, источники…', action: 'Добавить направление или материал' },
  library: { text: 'Карта материалов. Книги, PDF, статьи и видео можно раскладывать островками.', action: 'Добавить материал' },
  projects: { text: 'Проект начинается просто: название — и свободная карта.', action: 'Новый проект' },
  project: { text: 'Свободная карта проекта: идеи, исследования, эскизы, расчёты, вопросы.', action: 'Добавить на карту проекта' },
  inspiration: { text: 'Всё, что зацепило: здания, мосты, горы, цвета. Объяснять не обязательно.', action: 'Сохранить вдохновение' },
  studio: { text: 'Чертёжный стол. Каждый эскиз хранится как линии, а не картинка.', action: 'Новый эскиз' },
  objects: { text: 'Реальные сооружения, которые ты сохранила.', action: 'Сохранить объект' },
  path: { text: 'Здесь появится карта того, что ты поняла, применила и создала.', action: '' },
};

export function EmptyHint({ space }: { space: Space; owner?: Entity }) {
  const h = HINTS[space.kind] ?? HINTS.home;
  return (
    <div className="empty-hint">
      <p>{h.text}</p>
      {h.action && (
        <button className="btn btn--primary" onPointerDown={(e) => e.stopPropagation()} onClick={() => useUI.getState().open({ kind: 'add', spaceId: space.id })}>
          {h.action}
        </button>
      )}
      {h.action && <small>или дважды нажми на пустом месте карты</small>}
    </div>
  );
}
