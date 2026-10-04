import { describe, expect, it } from 'vitest';
import { needSummary } from './needSummary';

describe('итог строки блюд (п. 54)', () => {
  it('одно блюдо с количеством', () => {
    expect(needSummary({ totalQuantity: 0.3, dishes: [{ quantity: 0.3 }] }))
      .toEqual({ dishes: '1 блюдо', quantity: '0,3' });
  });

  it('три блюда, у всех количество — точная сумма', () => {
    expect(needSummary({
      totalQuantity: 1.3,
      dishes: [{ quantity: 0.3 }, { quantity: 1 }, { quantity: 0 }],
    })).toEqual({ dishes: '3 блюда', quantity: '1,3' });
  });

  it('у части блюд количества нет — сумма с оговоркой «от»', () => {
    expect(needSummary({
      totalQuantity: 1.3,
      dishes: [{ quantity: 0.3 }, { quantity: 1 }, { quantity: null }],
    })).toEqual({ dishes: '3 блюда', quantity: 'от 1,3' });
  });

  it('количеств нет ни у одного — только число блюд', () => {
    expect(needSummary({ totalQuantity: null, dishes: [{ quantity: null }, { quantity: null }] }))
      .toEqual({ dishes: '2 блюда', quantity: null });
  });

  it('пять блюд — «блюд»', () => {
    expect(needSummary({ totalQuantity: null, dishes: Array(5).fill({ quantity: null }) }).dishes)
      .toBe('5 блюд');
  });
});
