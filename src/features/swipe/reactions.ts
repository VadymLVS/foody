/**
 * Реакции на серию отказов. См. D-021.
 *
 * Тон: приложение подшучивает над ситуацией, не над человеком.
 * Ничего про «опять ничего не выбрал» и прочих упрёков —
 * человек и так не может решить, что съесть, это и есть проблема,
 * которую мы решаем.
 *
 * Отключается в настройках (user_settings.playful_reactions).
 */

export const REACTION_THRESHOLDS = [5, 10, 15, 20] as const;

export const REACTIONS: Record<number, string[]> = {
  5: [
    'Ну хоть что-то же ты ешь?',
    'Пока ноль. Продолжаем поиск.',
    'Сложный день для холодильника.',
  ],
  10: [
    'Может, просто чай?',
    'Десять мимо. Уверенность растёт.',
    'Где-то тут должно быть что-то съедобное.',
  ],
  15: [
    'Холодильник смотрит на тебя с надеждой.',
    'Пятнадцать. Это уже принципиальная позиция.',
    'Предлагаю компромисс: бутерброд.',
  ],
  20: [
    'Ладно. Доставка так доставка.',
    'Сдаюсь. Ты победил.',
    'Двадцать. Записываю в книгу рекордов.',
  ],
};

/**
 * Выбирает фразу, не повторяя недавние.
 * `seen` хранится в сессии, не в базе: это шутка, а не данные.
 */
export function pickReaction(streak: number, seen: Set<string>): string | null {
  const threshold = REACTION_THRESHOLDS.find((t) => t === streak);
  if (!threshold) return null;

  const pool = REACTIONS[threshold] ?? [];
  const fresh = pool.filter((p) => !seen.has(p));
  const candidates = fresh.length > 0 ? fresh : pool;
  if (candidates.length === 0) return null;

  const chosen = candidates[Math.floor(Math.random() * candidates.length)]!;
  seen.add(chosen);
  return chosen;
}
