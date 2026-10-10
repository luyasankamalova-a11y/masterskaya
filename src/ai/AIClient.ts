// AI-интеграция (этап 4). Сейчас подключён NullAIClient.
// Контракт: ответ — только текст (Message) или предложение (Proposal).
// Прямого доступа к commit() у AI нет.
import type { Entity, ID, Proposal } from '../core/model/types';
import { getEntity, neighbours } from '../core/repo/queries';

export type SirianMode =
  | 'chat' | 'dont_understand' | 'check_hypothesis' | 'can_explain' | 'analyze_engineer'
  | 'analyze_project' | 'what_to_study' | 'find_links' | 'tidy_up' | 'check_drawing';

export interface SirianReply {
  message: string;
  proposals?: Omit<Proposal, 'id' | 'createdAt' | 'status'>[];
}

export interface AIRequest {
  mode: SirianMode;
  text: string;
  focusEntityId?: ID;
  /** Для «Я не понимаю»: какая ступень объяснения (1–5). */
  step?: number;
}

export interface AIClient {
  readonly available: boolean;
  ask(req: AIRequest, context: AIContext): Promise<SirianReply>;
}

export interface AIContext {
  focus?: Entity;
  related: Entity[];
  fragments: { entityId: ID; text: string; page?: number }[];
}

/**
 * Сборщик контекста: текущий объект и его связи.
 * Всё с «🔒 Не использовать AI» отбрасывается здесь — до любого запроса.
 */
export async function buildContext(focusId?: ID): Promise<AIContext> {
  if (!focusId) return { related: [], fragments: [] };
  const focus = await getEntity(focusId);
  if (!focus || focus.aiAccess === 'blocked') return { related: [], fragments: [] };
  const related = (await neighbours(focusId)).map((n) => n.entity).filter((e) => e.aiAccess !== 'blocked');
  return { focus, related, fragments: [] };
}

export class NullAIClient implements AIClient {
  readonly available = false;
  async ask(req: AIRequest, ctx: AIContext): Promise<SirianReply> {
    const about = ctx.focus ? ` про «${ctx.focus.title}»` : '';
    const lines: Record<SirianMode, string> = {
      chat: 'Мой разум пока не подключён — это следующий этап. Но я уже здесь и вижу, как растёт Мастерская.',
      dont_understand: `Я разберу это${about} по ступеням: просто, на примере, на инженерной ситуации, через формулу и в задаче. Как только меня подключат.`,
      check_hypothesis: 'Когда подключат разум, я не дам ответ сразу. Сначала спрошу: какую проблему ты здесь видишь?',
      can_explain: 'Объяснение уже можно записать в заметку объекта. Оценивать логику я начну после подключения.',
      analyze_engineer: 'Разбор по разделам — конструкция, материалы, основание, нагрузки — появится вместе с AI.',
      analyze_project: 'Учебный разбор проекта будет здесь. Это будет предварительный взгляд, не проектное заключение.',
      what_to_study: 'Посмотрю, что в проекте проработано, а что пусто, — после подключения.',
      find_links: 'Искать связи я буду сам, но предлагать — только с кнопками «Связать / Нет».',
      tidy_up: 'Группировку я только предложу. Двигать твои узлы без «Применить» не буду.',
      check_drawing: 'Проверка схемы появится вместе со Студией и AI. Стирать твою работу я не буду никогда.',
    };
    return { message: lines[req.mode] };
  }
}

export const aiClient: AIClient = new NullAIClient();
