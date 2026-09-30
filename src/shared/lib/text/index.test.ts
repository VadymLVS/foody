import { describe, expect, it } from 'vitest';
import { capitalize, formatNumber, multiSearch, norm, plural, searchByName, splitQuery } from './index';

const items = [
  { name: 'Огурцы' },
  { name: 'Масло сливочное' },
  { name: 'Масло растительное' },
  { name: 'Молоко' },
  { name: 'Яйца' },
];

describe('norm', () => {
  it('ё и е — одно и то же: иначе «творог» не найдёт «Творог»', () => {
    expect(norm('Ёлка')).toBe('елка');
  });
  it('снимает диакритику и лишние пробелы', () => {
    expect(norm('  Café   Latte ')).toBe('cafe latte');
  });
});

describe('searchByName', () => {
  it('ищет подстроку от двух символов', () => {
    expect(searchByName(items, 'ма').map((i) => i.name))
      .toEqual(['Масло растительное', 'Масло сливочное']);
  });
  it('короче двух символов — не фильтруем, иначе список мигает на первой букве', () => {
    expect(searchByName(items, 'м')).toHaveLength(items.length);
  });
  it('совпадение с начала идёт первым', () => {
    const found = searchByName([{ name: 'Сливки' }, { name: 'Масло сливочное' }], 'слив');
    expect(found[0]!.name).toBe('Сливки');
  });
});

describe('splitQuery', () => {
  it('разбирает произнесённую фразу на части', () => {
    expect(splitQuery('молоко, яйца и хлеб')).toEqual(['молоко', 'яйца', 'хлеб']);
  });
  it('выбрасывает слишком короткие части', () => {
    expect(splitQuery('молоко я хлеб')).toEqual(['молоко', 'хлеб']);
  });
});

describe('multiSearch', () => {
  it('фраза целиком важнее частей: «масло сливочное» — это один продукт', () => {
    const result = multiSearch(items, 'масло сливочное');
    expect(result.matches.map((i) => i.name)).toEqual(['Масло сливочное']);
    expect(result.missing).toEqual([]);
  });

  it('несколько продуктов одной фразой', () => {
    const result = multiSearch(items, 'молоко яйца');
    expect(result.matches.map((i) => i.name)).toEqual(['Молоко', 'Яйца']);
    expect(result.missing).toEqual([]);
  });

  it('ненайденные части возвращаются для «Создать»', () => {
    const result = multiSearch(items, 'молоко трюфель');
    expect(result.matches.map((i) => i.name)).toEqual(['Молоко']);
    expect(result.missing).toEqual(['трюфель']);
  });

  it('окончание не мешает: «огурец» находит «Огурцы»', () => {
    const result = multiSearch(items, 'огурец молоко');
    expect(result.matches.map((i) => i.name)).toContain('Огурцы');
  });

  it('когда не нашлось ничего, предлагаем создать всю фразу', () => {
    expect(multiSearch(items, 'трюфель').missing).toEqual(['трюфель']);
  });
});

describe('plural', () => {
  it('склоняет по-русски', () => {
    const noun = (n: number) => plural(n, 'продукт', 'продукта', 'продуктов');
    expect(noun(1)).toBe('продукт');
    expect(noun(2)).toBe('продукта');
    expect(noun(5)).toBe('продуктов');
    expect(noun(11)).toBe('продуктов');
    expect(noun(21)).toBe('продукт');
    expect(noun(112)).toBe('продуктов');
  });
});

describe('formatNumber', () => {
  it('целое — без запятой, дробное — с запятой', () => {
    expect(formatNumber(2)).toBe('2');
    expect(formatNumber(1.5)).toBe('1,5');
    expect(formatNumber(0.3)).toBe('0,3');
  });
});

describe('capitalize', () => {
  it('делает из произнесённой части имя продукта', () => {
    expect(capitalize('огурцы')).toBe('Огурцы');
  });
});
