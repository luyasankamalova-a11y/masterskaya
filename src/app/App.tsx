// Корень приложения: первый запуск, маршрут, глобальные слои интерфейса.
import { useEffect, useState } from 'react';
import { bootstrap } from '../core/repo/bootstrap';
import { WorldView } from '../spaces/WorldView';
import { SpaceView } from '../spaces/SpaceView';
import { SketchEditor } from '../studio/SketchEditor';
import { TopBar } from '../shell/TopBar';
import { AddSheet } from '../shell/AddSheet';
import { SearchSheet } from '../shell/SearchSheet';
import { SettingsSheet } from '../shell/SettingsSheet';
import { SectionsSheet } from '../shell/SectionsSheet';
import { LinkSheet } from '../shell/LinkSheet';
import { GrowSheet } from '../shell/GrowSheet';
import { EntityPanel } from '../shell/EntityPanel';
import { ContextMenu } from '../shell/ContextMenu';
import { LinkKindBar } from '../shell/LinkKindBar';
import { ConfirmHost } from '../shell/confirm';
import { SirianDock, SirianSheet } from '../sirian/SirianDock';
import { startWatcher } from '../sirian/watcher';
import { useUI } from '../store/ui';
import { useRoute } from './router';

export function App() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const route = useRoute();
  const { sheet, panelId, menu, toast } = useUI();

  useEffect(() => {
    bootstrap().then(() => setReady(true)).catch((e) => setError(String(e?.message ?? e)));
  }, []);
  useEffect(() => (ready ? startWatcher() : undefined), [ready]);
  // Смена места закрывает меню и режим соединения
  useEffect(() => { useUI.setState({ menu: null, connectFrom: null }); }, [route]);

  if (error) {
    return <div className="screen-message">Не удалось открыть хранилище Мастерской: {error}. Проверь, не открыт ли приватный режим браузера.</div>;
  }
  if (!ready) return <div className="boot" aria-label="Мастерская открывается" />;

  const studio = route.name === 'sketch';
  return (
    <div className={`app${studio ? ' app--clean' : ''}`}>
      <main className="stage" key={route.name === 'world' ? 'world' : `${route.name}:${route.id}`}>
        {route.name === 'world' && <WorldView />}
        {route.name === 'space' && <SpaceView spaceId={route.id} />}
        {route.name === 'sketch' && <SketchEditor entityId={route.id} />}
      </main>
      {!studio && <TopBar route={route} />}
      <SirianDock />
      {panelId && <EntityPanel id={panelId} />}
      {menu && <ContextMenu menu={menu} />}
      <LinkKindBar />
      {sheet?.kind === 'add' && <AddSheet spaceId={sheet.spaceId} at={sheet.at} />}
      {sheet?.kind === 'search' && <SearchSheet />}
      {sheet?.kind === 'settings' && <SettingsSheet />}
      {sheet?.kind === 'sections' && <SectionsSheet />}
      {sheet?.kind === 'link' && <LinkSheet fromId={sheet.fromId} />}
      {sheet?.kind === 'grow' && <GrowSheet ideaId={sheet.ideaId} />}
      {sheet?.kind === 'sirian' && <SirianSheet />}
      <ConfirmHost />
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
