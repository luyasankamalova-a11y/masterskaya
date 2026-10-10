// Сириан в мире: сидит в углу, не мешает. По нажатию — разговор и его предложения.
import { useState } from 'react';
import type { Proposal } from '../core/model/types';
import { resolveProposal } from '../core/repo/actions';
import { getEntity, pendingProposals } from '../core/repo/queries';
import { aiClient, buildContext } from '../ai/AIClient';
import { useLive } from '../store/useLive';
import { useUI } from '../store/ui';
import { Sheet } from '../shell/Sheet';
import { sirian, useSirian } from './controller';
import { GREETINGS } from './persona';
import { StaticImageRenderer } from './renderers/StaticImageRenderer';

/** Единственная точка выбора рендерера: позже здесь SpriteRenderer или RiveRenderer. */
const Renderer = StaticImageRenderer;

export function SirianDock() {
  const state = useSirian();
  return (
    <button
      className={`sirian-dock${state.hasThought ? ' has-thought' : ''}`}
      onClick={() => { sirian.listen(); useUI.getState().open({ kind: 'sirian' }); }}
      aria-label={state.hasThought ? 'Сириан — у него есть мысль' : 'Сириан'}
      data-testid="sirian"
    >
      <Renderer state={state} variant="avatar" size={64} />
      {state.hasThought && <span className="sirian-dock__thought" aria-hidden />}
    </button>
  );
}

interface Line { from: 'me' | 'sirian'; text: string }

export function SirianSheet() {
  const state = useSirian();
  const proposals = useLive(pendingProposals, [], ['proposals']) ?? [];
  const panelId = useUI((s) => s.panelId);
  const [lines, setLines] = useState<Line[]>(() => [{ from: 'sirian', text: GREETINGS[Math.floor(Math.random() * GREETINGS.length)] }]);
  const [q, setQ] = useState('');
  const close = () => { sirian.rest(); useUI.getState().close(); };

  async function ask() {
    const text = q.trim();
    if (!text) return;
    setQ('');
    setLines((l) => [...l, { from: 'me', text }]);
    sirian.think();
    // Разговор не сохраняется в Мастерскую: он живёт только в этом окне.
    const reply = await aiClient.ask({ mode: 'chat', text }, await buildContext(panelId ?? undefined));
    sirian.speak('playful');
    setLines((l) => [...l, { from: 'sirian', text: reply.message }]);
  }

  return (
    <Sheet title="Сириан" onClose={close} className="sirian-sheet">
      <div className={`sirian-sheet__portrait sirian-tint--${state.tint}`}>
        <Renderer state={state} variant="portrait" />
      </div>
      {proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
      <div className="chat" aria-live="polite">
        {lines.map((l, i) => <p key={i} className={`chat__line chat__line--${l.from}`}>{l.text}</p>)}
      </div>
      <form className="chat__ask" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Спросить Сириана" aria-label="Вопрос Сириану" />
        <button className="btn" type="submit">Спросить</button>
      </form>
      <p className="hint">Разум Сириана подключится на этапе 4. Сейчас он замечает выросшие идеи и ничего не меняет без твоего «да». Разговор не сохраняется.</p>
    </Sheet>
  );
}

function ProposalCard({ p }: { p: Proposal }) {
  const idea = useLive(() => getEntity(String(p.payload.entityId)), [p.id]);
  if (!idea) return null;
  return (
    <div className="proposal" data-testid="proposal">
      <p>{p.reason}</p>
      <div className="row">
        <button className="btn btn--primary" onClick={() => useUI.getState().open({ kind: 'grow', ideaId: idea.id })}>Превратить в проект</button>
        <button className="btn" onClick={() => resolveProposal(p.id, 'rejected')}>Не сейчас</button>
      </div>
    </div>
  );
}
