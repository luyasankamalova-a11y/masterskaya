// Открыть объект: у пространственных объектов — их карта, у эскиза — Студия,
// у остальных — карточка объекта поверх текущей карты.
import type { Entity } from '../core/model/types';
import { typeDef } from '../core/registry/entityTypes';
import { spaceOwnedBy } from '../core/repo/queries';
import { useUI } from '../store/ui';
import { go } from './router';

export async function openEntity(e: Entity) {
  useUI.setState({ menu: null, sheet: null });
  if (typeDef(e.type).ownSpace) {
    const sp = await spaceOwnedBy(e.id);
    if (sp) { useUI.setState({ panelId: null }); go({ name: 'space', id: sp.id }); return; }
  }
  if (e.type === 'sketch') { useUI.setState({ panelId: null }); go({ name: 'sketch', id: e.id }); return; }
  useUI.setState({ panelId: e.id });
}
