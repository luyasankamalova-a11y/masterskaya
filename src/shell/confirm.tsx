// Подтверждение необратимых действий — своё окно, а не системный confirm().
import { create } from 'zustand';

interface ConfirmState {
  text: string | null;
  action: string;
  resolve: ((ok: boolean) => void) | null;
}

const useConfirm = create<ConfirmState>()(() => ({ text: null, action: 'Да', resolve: null }));

export function confirmAction(text: string, action = 'Удалить'): Promise<boolean> {
  return new Promise((resolve) => useConfirm.setState({ text, action, resolve }));
}

export function ConfirmHost() {
  const { text, action, resolve } = useConfirm();
  if (!text || !resolve) return null;
  const done = (ok: boolean) => { useConfirm.setState({ text: null, resolve: null }); resolve(ok); };
  return (
    <div className="scrim scrim--top" onPointerDown={(e) => { if (e.target === e.currentTarget) done(false); }}>
      <div className="confirm" role="alertdialog" aria-label={text}>
        <p>{text}</p>
        <div className="row-end">
          <button className="btn" onClick={() => done(false)} autoFocus>Отмена</button>
          <button className="btn btn--danger" onClick={() => done(true)}>{action}</button>
        </div>
      </div>
    </div>
  );
}
