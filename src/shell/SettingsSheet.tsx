// Настройки: режим данных (реальная Мастерская / отдельное демо), экспорт и импорт,
// место на устройстве, архив, полная очистка.
import { useRef, useState } from 'react';
import { currentMode, setMode } from '../core/db/schema';
import { exportArchive, importArchive, wipeAll } from '../core/repo/archive';
import { restoreEntity } from '../core/repo/actions';
import { archivedEntities } from '../core/repo/queries';
import { bootstrap } from '../core/repo/bootstrap';
import { seedDemo } from '../core/repo/demo';
import { typeDef } from '../core/registry/entityTypes';
import { formatSize, requestPersistence, storageInfo } from '../files/fileStore';
import { syncAdapter } from '../core/sync/SyncAdapter';
import { go } from '../app/router';
import { useLive } from '../store/useLive';
import { toast, useUI } from '../store/ui';
import { confirmAction } from './confirm';
import { Sheet } from './Sheet';

export function SettingsSheet() {
  const close = useUI((s) => s.close);
  const mode = currentMode();
  const archived = useLive(archivedEntities, [], ['entities']) ?? [];
  const storage = useLive(storageInfo, []);
  const [busy, setBusy] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  function switchMode(m: 'real' | 'demo') {
    if (m === mode) return;
    setMode(m);
    location.hash = '#/';
    location.reload();
  }

  async function doExport() {
    const blob = await exportArchive();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `masterskaya-${mode === 'demo' ? 'demo-' : ''}${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast('Архив Мастерской сохранён');
  }

  async function doImport(f?: File) {
    if (!f) return;
    if (!(await confirmAction('Импорт заменит всё, что сейчас лежит в этой Мастерской, содержимым архива. Продолжить?', 'Заменить'))) return;
    try {
      setBusy(true);
      const r = await importArchive(f);
      await bootstrap();
      toast(`Импортировано объектов: ${r.entities}`);
      close();
      go({ name: 'world' });
    } catch (e) {
      toast((e as Error).message);
    } finally { setBusy(false); }
  }

  return (
    <Sheet title="Настройки" onClose={close} wide>
      <section className="settings__block">
        <h3>Режим</h3>
        <div className="segmented" role="radiogroup">
          <button role="radio" aria-checked={mode === 'real'} className={mode === 'real' ? 'is-on' : ''} onClick={() => switchMode('real')}>Моя Мастерская</button>
          <button role="radio" aria-checked={mode === 'demo'} className={mode === 'demo' ? 'is-on' : ''} onClick={() => switchMode('demo')} data-testid="mode-demo">Демо</button>
        </div>
        <p className="hint">Демо живёт в отдельной базе и никогда не смешивается с твоими данными.</p>
        {mode === 'demo' && (
          <div className="row">
            <button className="btn" disabled={busy} data-testid="seed-demo" onClick={async () => {
              setBusy(true);
              try { await seedDemo(); toast('Демо-пример готов: путь «идея → исследование → материал → тема → эскиз»'); close(); go({ name: 'world' }); }
              catch (e) { toast((e as Error).message); } finally { setBusy(false); }
            }}>Заполнить демо-примером</button>
            <button className="btn" onClick={async () => { if (await confirmAction('Очистить демо-базу?', 'Очистить')) { await wipeAll(); await bootstrap(); toast('Демо очищено'); } }}>Очистить демо</button>
          </div>
        )}
      </section>

      <section className="settings__block">
        <h3>Мои данные</h3>
        <div className="row">
          <button className="btn" onClick={doExport} data-testid="export">Экспорт всей Мастерской</button>
          <button className="btn" disabled={busy} onClick={() => importInput.current?.click()}>Импорт из архива</button>
          <input ref={importInput} type="file" accept="application/json,.json" hidden data-testid="import-file" onChange={(e) => doImport(e.target.files?.[0])} />
        </div>
        <p className="hint">
          Данные хранятся на этом устройстве, в пределах места, которое выделяет браузер
          {storage?.usage !== undefined && <> — сейчас занято {formatSize(storage.usage)}{storage.quota ? ` из доступных ${formatSize(storage.quota)}` : ''}</>}.
          {storage?.persisted ? ' Браузер обещал не удалять их сам.' : ''}
        </p>
        {!storage?.persisted && (
          <button className="btn btn--small" onClick={async () => toast((await requestPersistence()) ? 'Браузер будет хранить данные надёжно' : 'Браузер не разрешил — делай экспорт время от времени')}>
            Попросить браузер хранить данные надёжно
          </button>
        )}
        <p className="hint">Синхронизация: {syncAdapter.name === 'local' ? 'только это устройство (облако — этап 7)' : syncAdapter.name}.</p>
      </section>

      <section className="settings__block">
        <h3>Архив</h3>
        {!archived.length && <p className="hint">В архиве пусто.</p>}
        <ul className="results">
          {archived.map((e) => (
            <li key={e.id} className="row-between">
              <span>{typeDef(e.type).icon} {e.title}</span>
              <button className="btn btn--small" onClick={() => restoreEntity(e.id)}>Вернуть</button>
            </li>
          ))}
        </ul>
      </section>

      <section className="settings__block">
        <h3>Очистить</h3>
        <button className="btn btn--danger" onClick={async () => {
          if (await confirmAction(`Удалить всё из ${mode === 'demo' ? 'демо-базы' : 'своей Мастерской'}? Это нельзя отменить — сначала сделай экспорт.`, 'Удалить всё')) {
            await wipeAll(); await bootstrap(); toast('Мастерская очищена'); close(); go({ name: 'world' });
          }
        }}>Удалить всё</button>
      </section>
      <p className="hint">Моя Мастерская · этап 0 · данные: {mode === 'demo' ? 'демо-база' : 'основная база'}</p>
    </Sheet>
  );
}
