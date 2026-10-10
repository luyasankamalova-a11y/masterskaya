// Голос (этап 5). Здесь только архитектурная граница — интерфейс и правила.
//
// Два разных понятия:
//  • TemporaryRecording — запись текущего голосового диалога. Живёт в памяти сессии,
//    используется для распознавания и после диалога удаляется. В базу НЕ попадает.
//  • VoiceNote — постоянный объект Мастерской (Entity type 'voice' + файл).
//    Создаётся ТОЛЬКО после «Сохрани это» или подтверждения
//    «Сохранить эту мысль в Мастерской?» — обычным createEntity() через commit().
// Разговор с Сирианом не становится памятью автоматически.

export interface TemporaryRecording {
  readonly audio: Blob;
  readonly startedAt: number;
  /** Удалить запись из памяти после диалога. */
  discard(): void;
}

export interface VoiceAdapter {
  readonly canRecord: boolean;
  /** Начать временную запись. Возвращает функцию остановки. */
  record(): Promise<() => Promise<TemporaryRecording>>;
  /** Распознать речь (облако, при наличии сети). */
  transcribe(rec: TemporaryRecording): Promise<string>;
  /** Озвучить ответ Сириана (позже). */
  speak?(text: string): Promise<void>;
}

/** Сириан отвечает только после паузы — не перебивает. */
export const PAUSE_BEFORE_REPLY_MS = 1700;
