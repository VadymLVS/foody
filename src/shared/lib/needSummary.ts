import { formatNumber, plural } from './text';

export interface NeedLike {
  totalQuantity: number | null;
  dishes: Array<{ quantity: number | null }>;
}

export interface NeedSummary {
  /** «3 блюда» */
  dishes: string;
  /** «1,3» или «от 1,3» — без единицы; null, если количеств нет ни у одного блюда. */
  quantity: string | null;
}

/**
 * Строка блюд в строке продукта — итогом, а не перечнем (backlog п. 54, D-103).
 *
 * Раньше строка перечисляла блюда с количествами: «Грибной крем-суп 0,3 кг ·
 * Картофельный гратен 1 кг и ещё 1». Она тянулась во всю ширину и ложилась на
 * картинку продукта, где не читалась (Vadym, 10-02). Итог короче и полезнее
 * в магазине: сколько всего брать, без сложения в уме. Какие именно блюда —
 * в панели по тапу, блок «Нужно для» там уже есть.
 *
 * «от 1,3» — когда у части блюд количество не указано: сумма тогда нижняя
 * граница, и сказать «1,3» без оговорки значило бы обещать то, чего мы не знаем.
 */
export function needSummary(need: NeedLike): NeedSummary {
  const n = need.dishes.length;
  const dishes = `${n} ${plural(n, 'блюдо', 'блюда', 'блюд')}`;
  const total = need.totalQuantity;
  if (total === null || !(total > 0)) return { dishes, quantity: null };
  const partial = need.dishes.some((d) => d.quantity === null);
  return { dishes, quantity: `${partial ? 'от ' : ''}${formatNumber(total)}` };
}
