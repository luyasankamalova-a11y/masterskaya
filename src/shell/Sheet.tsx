// Основа всплывающих панелей: затемнение, закрытие по Esc и по нажатию вне панели.
import { type ReactNode, useEffect } from 'react';

export function Sheet({ title, onClose, children, wide, className = '' }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean; className?: string;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="scrim" onPointerDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`sheet${wide ? ' sheet--wide' : ''} ${className}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="sheet__head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Закрыть">✕</button>
        </header>
        <div className="sheet__body">{children}</div>
      </section>
    </div>
  );
}
