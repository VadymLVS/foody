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
  /**
   * Свой номер у каждой постановки в очередь. Сравнивать по ключу и времени
   * нельзя: две отметки одного продукта попадают в одну миллисекунду, и
   * отправка выбрасывала бы из очереди свежую отметку вместе с отправленной
   * (найдено модульным тестом к R-6).
   */
  id: number;
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
let nextId = queue.reduce((max, op) => Math.max(max, op.id ?? 0), 0) + 1;

function load(): QueuedOp[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueuedOp[];
    // Очередь из прежних версий номеров не знает — раздаём при загрузке
    return parsed
      .filter((op) => Date.now() - op.ts < MAX_AGE_MS)
      .map((op, i) => ({ ...op, id: op.id ?? i + 1 }));
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
  queue = [
    ...queue.filter((op) => op.key !== key),
    { id: nextId++, key, productId, patch, ts: Date.now() },
  ];
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
 *
 * Две правки после обзора 09-26 (R-6):
 *
 * 1. Отправка идёт по одной и занимает время. Если в это время человек
 *    отметил тот же продукт ещё раз, прежняя версия сравнивалась по одному
 *    ключу — и новая отметка исчезала вместе с отправленной. Теперь из очереди
 *    уходит ровно та постановка, которую отправили, по своему номеру.
 * 2. Два вызова разом (событие online и таймер пришли вместе) отправляли
 *    одно и то же дважды. Теперь второй вызов просто ждёт своей очереди.
 *
 * dropped — отброшенные отказы сервера: список у человека уже показывает
 * их применёнными, поэтому экран обязан сказать, что сохранить не удалось.
 */
let flushing = false;

export interface FlushResult {
  sent: number;
  dropped: number;
}

export async function flush(apply: (op: QueuedOp) => Promise<void>): Promise<FlushResult> {
  if (flushing || queue.length === 0) return { sent: 0, dropped: 0 };
  flushing = true;

  try {
    const snapshot = [...queue];
    const done: QueuedOp[] = [];     // отправленные и отброшенные — уходят из очереди
    let sent = 0;
    let dropped = 0;

    for (const op of snapshot) {
      try {
        await apply(op);
        done.push(op);
        sent += 1;
      } catch (error) {
        if (!isNetworkError(error)) {
          // Сервер её не примет и со второго раза: нарушение прав, дубль имени
          done.push(op);
          dropped += 1;
        }
      }
    }

    const finished = new Set(done.map((op) => op.id));
    queue = queue.filter((op) => !finished.has(op.id));
    persist();
    return { sent, dropped };
  } finally {
    flushing = false;
  }
}

export function clearQueue() {
  queue = [];
  persist();
}
