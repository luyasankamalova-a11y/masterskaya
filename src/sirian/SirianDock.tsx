// Сириан в мире: сидит в углу, не мешает. По нажатию — его наблюдения и предложения.
// Разговора на этапе 0 нет: AI подключается на этапе 4.
import { useState } from 'react';
import type { Proposal } from '../core/model/types';
import { resolveProposal } from '../core/repo/actions';
import { getEntity, pendingProposals } from '../core/repo/queries';
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

export function SirianSheet() {
  const state = useSirian();
  const proposals = useLive(pendingProposals, [], ['proposals']) ?? [];
  const [greeting] = useState(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)]);
  const close = () => { sirian.rest(); useUI.getState().close(); };

  return (
    <Sheet title="Сириан" onClose={close} className="sirian-sheet">
      <div className={`sirian-sheet__portrait sirian-tint--${state.tint}`}>
        <Renderer state={state} variant="portrait" />
      </div>
      <p className="chat__line chat__line--sirian">{proposals.length ? 'Я кое-что заметил.' : greeting}</p>
      {proposals.map((p) => <ProposalCard key={p.id} p={p} />)}
      <p className="hint">
        Разговаривать Сириан пока не умеет: разум подключится на этапе 4.
        Сейчас он только замечает выросшие идеи и ничего не меняет без твоего «да».
      </p>
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
