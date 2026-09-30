import { beforeEach, describe, expect, it } from 'vitest';
import { clearQueue, enqueue, flush, isNetworkError, pendingCount } from './opQueue';

/**
 * Очередь несохранённых правок — единственное место, где приложение обещает
 * «отмеченное не потеряется» (подвал супермаркета, связь пропадает). Оба
 * дефекта из обзора 09-26 (R-6) закреплены тестами ниже, чтобы не вернулись.
 */
const networkError = () => new Error('Failed to fetch');
const serverError = () => new Error('duplicate key value violates unique constraint');

beforeEach(() => {
  clearQueue();
});

describe('isNetworkError', () => {
  it('сетевой сбой узнаёт по сообщению', () => {
    expect(isNetworkError(networkError())).toBe(true);
    expect(isNetworkError(new Error('Load failed'))).toBe(true);
  });
  it('отказ сервера сетевым не считает: повторять его бессмысленно', () => {
    expect(isNetworkError(serverError())).toBe(false);
  });
});

describe('enqueue', () => {
  it('повторная отметка того же поля вытесняет прежнюю', () => {
    enqueue('p1', { in_stock: true });
    enqueue('p1', { in_stock: false });
    expect(pendingCount()).toBe(1);
  });

  it('разные поля одного продукта живут отдельно', () => {
    enqueue('p1', { in_stock: true });
    enqueue('p1', { quantity: 2 });
    expect(pendingCount()).toBe(2);
  });
});

describe('flush', () => {
  it('отправленное уходит из очереди', async () => {
    enqueue('p1', { in_stock: true });
    enqueue('p2', { in_stock: true });
    const result = await flush(async () => {});
    expect(result).toEqual({ sent: 2, dropped: 0 });
    expect(pendingCount()).toBe(0);
  });

  it('упавшее по сети остаётся ждать', async () => {
    enqueue('p1', { in_stock: true });
    const result = await flush(async () => { throw networkError(); });
    expect(result).toEqual({ sent: 0, dropped: 0 });
    expect(pendingCount()).toBe(1);
  });

  it('отказ сервера отбрасывается и попадает в счётчик — экран обязан сказать', async () => {
    enqueue('p1', { in_stock: true });
    const result = await flush(async () => { throw serverError(); });
    expect(result).toEqual({ sent: 0, dropped: 1 });
    expect(pendingCount()).toBe(0);
  });

  it('R-6: отметка во время отправки не исчезает вместе с отправленной', async () => {
    enqueue('p1', { in_stock: true });
    // человек отмечает тот же продукт ещё раз, пока первая отправка в полёте
    const result = await flush(async () => {
      enqueue('p1', { in_stock: false });
    });
    expect(result.sent).toBe(1);
    // прежняя ушла, новая осталась: раньше обе исчезали по одному ключу
    expect(pendingCount()).toBe(1);
  });

  it('R-6: два вызова разом не отправляют одно и то же дважды', async () => {
    enqueue('p1', { in_stock: true });
    let calls = 0;
    const slow = async () => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 20));
    };
    const [first, second] = await Promise.all([flush(slow), flush(slow)]);
    expect(calls).toBe(1);
    expect(first.sent + second.sent).toBe(1);
  });

  it('пустая очередь не ходит на сервер', async () => {
    let calls = 0;
    const result = await flush(async () => { calls += 1; });
    expect(calls).toBe(0);
    expect(result).toEqual({ sent: 0, dropped: 0 });
  });
});
