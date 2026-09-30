import { describe, expect, it } from 'vitest';
import { dishAllowed, forbiddenGroups, productAllowed } from './diet';

/**
 * Питание решает, что человек увидит в подсказках (D-060). Ошибка здесь
 * показывает вегану свинину — поэтому правила проверяются по каждому типу,
 * а не «в среднем».
 */
describe('forbiddenGroups', () => {
  it('без ответа про питание ничего не запрещает', () => {
    expect(forbiddenGroups(null).size).toBe(0);
    expect(forbiddenGroups({ diet: null, excludes: [] }).size).toBe(0);
  });

  it('вегетарианцу — без мяса и рыбы, но с молочным', () => {
    const forbidden = forbiddenGroups({ diet: 'vegetarian', excludes: [] });
    expect(forbidden.has('pork')).toBe(true);
    expect(forbidden.has('fish')).toBe(true);
    expect(forbidden.has('dairy')).toBe(false);
  });

  it('пескетарианцу рыба можно, мясо нельзя', () => {
    const forbidden = forbiddenGroups({ diet: 'pescatarian', excludes: [] });
    expect(forbidden.has('fish')).toBe(false);
    expect(forbidden.has('seafood')).toBe(false);
    expect(forbidden.has('beef')).toBe(true);
  });

  it('вегану нельзя и молочное с яйцами', () => {
    const forbidden = forbiddenGroups({ diet: 'vegan', excludes: [] });
    for (const group of ['pork', 'beef', 'poultry', 'fish', 'seafood', 'dairy', 'eggs'] as const) {
      expect(forbidden.has(group), group).toBe(true);
    }
  });

  it('теги «не ем» и «аллергии» добавляются к типу питания', () => {
    const forbidden = forbiddenGroups({ diet: 'omnivore', excludes: ['mushrooms', 'nuts'] });
    expect(forbidden.has('mushrooms')).toBe(true);
    expect(forbidden.has('nuts')).toBe(true);
    expect(forbidden.has('pork')).toBe(false);
  });
});

describe('productAllowed', () => {
  const vegetarian = forbiddenGroups({ diet: 'vegetarian', excludes: [] });

  it('продукт из запрещённой группы не проходит', () => {
    expect(productAllowed('pork', vegetarian)).toBe(false);
    expect(productAllowed('chicken', vegetarian)).toBe(false);
  });

  it('обычный продукт проходит', () => {
    expect(productAllowed('potato', vegetarian)).toBe(true);
  });

  it('незнакомый продукт не прячем: спорное — в сторону показа', () => {
    expect(productAllowed('unknown_thing', vegetarian)).toBe(true);
    expect(productAllowed(null, vegetarian)).toBe(true);
  });
});

describe('dishAllowed', () => {
  const vegan = forbiddenGroups({ diet: 'vegan', excludes: [] });

  it('блюдо с одним запрещённым продуктом целиком не подходит', () => {
    expect(dishAllowed(['potato', 'onion', 'cheese'], vegan)).toBe(false);
  });

  it('блюдо без запрещённых продуктов подходит', () => {
    expect(dishAllowed(['potato', 'onion', 'tomato'], vegan)).toBe(true);
  });

  it('блюдо без состава не прячем', () => {
    expect(dishAllowed([], vegan)).toBe(true);
  });
});
