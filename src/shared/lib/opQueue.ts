/**
 * Очередь несохранённых изменений.
 *
 * Главный сценарий продукта — стоять в подвале супермаркета и отмечать
 * купленное. Связь там пропадает регулярно. Без очереди каждое изменение,
 * не долетевшее до сервера, откатывалось бы: отметил десять позиций,
 * сохранилось три.
 *
 * Это не полноценный офлайн-режим: читать без сети приложение по-прежнему
 * не умеет, работают только уже загруженные данные. Но записи не теряются.
 */

import type { ProductPatch } from '@/shared/api/repo';

export interface QueuedOp {
  key: string;          // productId + поле: повторная отметка вытесняет прежнюю
  productId: string;
  patch: ProductPatch;
  ts: number;
}

const STORAGE_KEY = 'pantrysync:queue:v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;   // сутки — дальше правка уже неактуальна

type Listener = (pending: number) => void;

let queue: QueuedOp[] = load();
const listeners = new Set<Listener>();

function load(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedOp[];
    return parsed.filter((op) => Date.now() - op.ts < MAX_AGE_MS);
  } catch {
    return [];   // приватный режим или повреждённые данные
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch { /* не критично: очередь живёт хотя бы в памяти */ }
  listeners.forEach((fn) => fn(queue.length));
}

/**
 * Сетевая ошибка или отказ сервера — разные вещи. Нарушение прав или
 * дубль имени повторять бессмысленно, их надо откатывать сразу.
 */
export function isNetworkError(error: unknown): boolean {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true;
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return ['failed to fetch', 'networkerror', 'network request failed',
          'load failed', 'timeout', 'econnrefused'].some((m) => message.includes(m));
}

export function enqueue(productId: string, patch: ProductPatch) {
  const field = Object.keys(patch)[0] ?? '';
  const key = `${productId}:${field}`;
  // Последнее значение вытесняет прежнее: отправлять промежуточные состояния
  // одного и того же тоггла незачем.
  queue = [...queue.filter((op) => op.key !== key), { key, productId, patch, ts: Date.now() }];
  persist();
}

export const pendingCount = () => queue.length;

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener(queue.length);
  return () => listeners.delete(listener);
}

/**
 * Отправляет накопленное. Операции, снова упавшие по сети, остаются
 * в очереди; упавшие по другой причине выбрасываются — повтор их не спасёт.
 */
export async function flush(apply: (op: QueuedOp) => Promise<void>): Promise<number> {
  if (queue.length === 0) return 0;

  const snapshot = [...queue];
  const failed: QueuedOp[] = [];
  let sent = 0;

  for (const op of snapshot) {
    try {
      await apply(op);
      sent += 1;
    } catch (error) {
      if (isNetworkError(error)) failed.push(op);
      // иначе операция отбрасывается: сервер её не примет и со второго раза
    }
  }

  const stillQueued = new Set(failed.map((op) => op.key));
  queue = queue.filter((op) => stillQueued.has(op.key) || !snapshot.some((s) => s.key === op.key));
  persist();
  return sent;
}

export function clearQueue() {
  queue = [];
  persist();
}
