/**
 * Стартовый справочник блюд для карусели (backlog п. 4, 6; D-043).
 *
 * Универсальные европейские блюда без национального уклона (выбор Vadym).
 * Составлен вручную, а не спарсен: приложению нужен только состав, а каждый
 * ингредиент обязан ссылаться на ключ справочника продуктов — иначе при выборе
 * блюда нельзя завести недостающие продукты в кухне автоматически.
 *
 * Количество примерно на 3–4 порции, в единице продукта (D-030). Где количество
 * спорное (масло для жарки, специи), оно не указано — отметка без числа честнее.
 *
 * Живёт в коде, а не в базе: работает в демо-режиме и не требует миграции.
 * Названия блюд и продуктов берутся из словаря по ключу (D-034).
 */
import type { Unit } from '@/shared/db/types';

/** Единица и отдел для каждого продукта, на который ссылаются блюда. */
export const PRODUCT_META: Record<string, { unit: Unit; category: string }> = {
  apple: { unit: 'kg', category: 'fruits' },
  avocado: { unit: 'pcs', category: 'fruits' },
  bacon: { unit: 'pack', category: 'meat_fish' },
  baking_powder: { unit: 'pack', category: 'pantry' },
  beans: { unit: 'pack', category: 'pantry' },
  beef: { unit: 'kg', category: 'meat_fish' },
  bread: { unit: 'pcs', category: 'bakery' },
  broccoli: { unit: 'kg', category: 'vegetables' },
  butter: { unit: 'pack', category: 'dairy' },
  carrot: { unit: 'kg', category: 'vegetables' },
  celery: { unit: 'pcs', category: 'vegetables' },
  cheese: { unit: 'g', category: 'dairy' },
  chicken: { unit: 'kg', category: 'meat_fish' },
  corn: { unit: 'pack', category: 'vegetables' },
  cream: { unit: 'pack', category: 'dairy' },
  cucumber: { unit: 'kg', category: 'vegetables' },
  eggplant: { unit: 'kg', category: 'vegetables' },
  eggs: { unit: 'pcs', category: 'dairy' },
  feta: { unit: 'pack', category: 'dairy' },
  flour: { unit: 'kg', category: 'pantry' },
  frozen_berries: { unit: 'pack', category: 'frozen' },
  garlic: { unit: 'pcs', category: 'vegetables' },
  greens: { unit: 'pack', category: 'vegetables' },
  honey: { unit: 'pack', category: 'pantry' },
  lemon: { unit: 'pcs', category: 'fruits' },
  lentils: { unit: 'kg', category: 'pantry' },
  lettuce: { unit: 'pcs', category: 'vegetables' },
  mayonnaise: { unit: 'pack', category: 'pantry' },
  milk: { unit: 'l', category: 'dairy' },
  mince: { unit: 'kg', category: 'meat_fish' },
  mozzarella: { unit: 'pack', category: 'dairy' },
  mushrooms: { unit: 'kg', category: 'vegetables' },
  oats: { unit: 'kg', category: 'pantry' },
  olive_oil: { unit: 'l', category: 'pantry' },
  onion: { unit: 'kg', category: 'vegetables' },
  pasta: { unit: 'pack', category: 'pantry' },
  pepper: { unit: 'kg', category: 'vegetables' },
  potato: { unit: 'kg', category: 'vegetables' },
  pumpkin: { unit: 'kg', category: 'vegetables' },
  rice: { unit: 'kg', category: 'pantry' },
  salmon: { unit: 'kg', category: 'meat_fish' },
  shrimp: { unit: 'pack', category: 'meat_fish' },
  sugar: { unit: 'kg', category: 'pantry' },
  tomato: { unit: 'kg', category: 'vegetables' },
  tomato_paste: { unit: 'pack', category: 'pantry' },
  tuna_canned: { unit: 'pack', category: 'meat_fish' },
  vinegar: { unit: 'l', category: 'pantry' },
  wine: { unit: 'pcs', category: 'drinks' },
  yeast: { unit: 'pack', category: 'pantry' },
  zucchini: { unit: 'kg', category: 'vegetables' },
  // ── Для блюд справочника v0.20 (расширение до 113 блюд) ──
  // Единицы — те же, что в сиде 0005: продукт, уже заведённый в кухне из
  // карусели продуктов, и продукт, созданный блюдом, обязаны совпадать.
  banana: { unit: 'kg', category: 'fruits' },
  beet: { unit: 'kg', category: 'vegetables' },
  cabbage: { unit: 'pcs', category: 'vegetables' },
  cauliflower: { unit: 'pcs', category: 'vegetables' },
  cherry_tomato: { unit: 'pack', category: 'vegetables' },
  spinach: { unit: 'pack', category: 'vegetables' },
  leek: { unit: 'pcs', category: 'vegetables' },
  sweet_potato: { unit: 'kg', category: 'vegetables' },
  ginger: { unit: 'pcs', category: 'vegetables' },
  green_peas: { unit: 'pack', category: 'frozen' },
  frozen_vegetables: { unit: 'pack', category: 'frozen' },
  puff_pastry: { unit: 'pack', category: 'frozen' },
  buckwheat: { unit: 'kg', category: 'pantry' },
  bulgur: { unit: 'pack', category: 'pantry' },
  couscous: { unit: 'pack', category: 'pantry' },
  quinoa: { unit: 'pack', category: 'pantry' },
  chickpeas: { unit: 'pack', category: 'pantry' },
  rice_noodles: { unit: 'pack', category: 'pantry' },
  coconut_milk: { unit: 'pack', category: 'pantry' },
  soy_sauce: { unit: 'ml', category: 'pantry' },
  mustard: { unit: 'pack', category: 'pantry' },
  bay_leaf: { unit: 'pack', category: 'pantry' },
  nuts: { unit: 'pack', category: 'pantry' },
  raisins: { unit: 'pack', category: 'pantry' },
  sesame: { unit: 'pack', category: 'pantry' },
  olives: { unit: 'pack', category: 'pantry' },
  pesto: { unit: 'pack', category: 'pantry' },
  cinnamon: { unit: 'pack', category: 'pantry' },
  cocoa: { unit: 'pack', category: 'pantry' },
  curry: { unit: 'pack', category: 'pantry' },
  paprika: { unit: 'pack', category: 'pantry' },
  oil: { unit: 'l', category: 'pantry' },
  sour_cream: { unit: 'pack', category: 'dairy' },
  cottage_cheese: { unit: 'pack', category: 'dairy' },
  yogurt: { unit: 'pack', category: 'dairy' },
  ricotta: { unit: 'pack', category: 'dairy' },
  // Тофу в магазине лежит в холодильнике рядом с молочным — туда и ставим
  tofu: { unit: 'pack', category: 'dairy' },
  lavash: { unit: 'pcs', category: 'bakery' },
  tortilla: { unit: 'pack', category: 'bakery' },
  cod: { unit: 'kg', category: 'meat_fish' },
  hake: { unit: 'kg', category: 'meat_fish' },
  mussels: { unit: 'kg', category: 'meat_fish' },
  // Продукты без блюда из готовых наборов (D-054)
  sausages: { unit: 'pack', category: 'meat_fish' },
  water: { unit: 'l', category: 'drinks' },
  juice: { unit: 'l', category: 'drinks' },
  coffee: { unit: 'pack', category: 'drinks' },
  chips: { unit: 'pack', category: 'sweets' },
  charcoal: { unit: 'pack', category: 'household' },
  napkins: { unit: 'pack', category: 'household' },
  disposable_tableware: { unit: 'pack', category: 'household' },
};

export interface LibraryDish {
  key: string;
  /** `other` — закуски и гарниры; в базе это категория «Прочее» (0005_seed). */
  category: 'soups' | 'mains' | 'salads' | 'breakfasts' | 'baking' | 'other';
  /** [ключ продукта, количество в единице продукта или null] */
  ingredients: Array<[string, number | null]>;
}

export const DISH_LIBRARY: LibraryDish[] = [
  // ── Основные ───────────────────────────────────────────
  { key: 'pasta_carbonara', category: 'mains', ingredients: [
    ['pasta', 1], ['bacon', 1], ['eggs', 3], ['cheese', 80], ['garlic', 1],
  ] },
  { key: 'pasta_bolognese', category: 'mains', ingredients: [
    ['pasta', 1], ['mince', 0.5], ['tomato_paste', 1], ['onion', 0.2], ['carrot', 0.1],
    ['garlic', 1], ['olive_oil', null],
  ] },
  { key: 'lasagna', category: 'mains', ingredients: [
    ['pasta', 1], ['mince', 0.5], ['tomato_paste', 1], ['onion', 0.2], ['milk', 0.5],
    ['butter', 1], ['flour', 0.05], ['cheese', 150],
  ] },
  { key: 'mushroom_risotto', category: 'mains', ingredients: [
    ['rice', 0.3], ['mushrooms', 0.3], ['onion', 0.1], ['butter', 1], ['cheese', 60], ['wine', null],
  ] },
  { key: 'shrimp_pasta', category: 'mains', ingredients: [
    ['pasta', 1], ['shrimp', 1], ['cream', 1], ['garlic', 1], ['lemon', 1], ['greens', 1],
  ] },
  { key: 'chicken_creamy_mushrooms', category: 'mains', ingredients: [
    ['chicken', 0.6], ['mushrooms', 0.3], ['cream', 1], ['onion', 0.1], ['garlic', 1],
  ] },
  { key: 'chicken_rice_vegetables', category: 'mains', ingredients: [
    ['chicken', 0.6], ['rice', 0.3], ['pepper', 0.2], ['carrot', 0.15], ['onion', 0.1],
  ] },
  { key: 'steak_potatoes', category: 'mains', ingredients: [
    ['beef', 0.5], ['potato', 1], ['butter', 1], ['garlic', 1], ['greens', 1],
  ] },
  { key: 'baked_salmon', category: 'mains', ingredients: [
    ['salmon', 0.5], ['zucchini', 0.3], ['pepper', 0.2], ['lemon', 1], ['olive_oil', null],
  ] },
  { key: 'ratatouille', category: 'mains', ingredients: [
    ['zucchini', 0.4], ['eggplant', 0.4], ['pepper', 0.3], ['tomato', 0.5], ['onion', 0.1],
    ['garlic', 1], ['olive_oil', null],
  ] },
  { key: 'potato_gratin', category: 'mains', ingredients: [
    ['potato', 1], ['cream', 1], ['cheese', 150], ['garlic', 1], ['butter', 1],
  ] },
  { key: 'shepherds_pie', category: 'mains', ingredients: [
    ['mince', 0.5], ['potato', 1], ['carrot', 0.15], ['onion', 0.15], ['milk', 0.2],
    ['butter', 1], ['tomato_paste', 1],
  ] },
  { key: 'meatballs_tomato', category: 'mains', ingredients: [
    ['mince', 0.5], ['eggs', 1], ['onion', 0.1], ['tomato_paste', 1], ['bread', 1], ['garlic', 1],
  ] },
  { key: 'pizza_margherita', category: 'mains', ingredients: [
    ['flour', 0.3], ['yeast', 1], ['tomato_paste', 1], ['mozzarella', 1], ['olive_oil', null],
    ['greens', 1],
  ] },

  // ── Супы ───────────────────────────────────────────────
  { key: 'minestrone', category: 'soups', ingredients: [
    ['zucchini', 0.2], ['carrot', 0.15], ['celery', 1], ['potato', 0.3], ['beans', 1],
    ['tomato_paste', 1], ['pasta', 1], ['onion', 0.1],
  ] },
  { key: 'pumpkin_soup', category: 'soups', ingredients: [
    ['pumpkin', 1], ['cream', 1], ['onion', 0.1], ['butter', 1],
  ] },
  { key: 'mushroom_soup', category: 'soups', ingredients: [
    ['mushrooms', 0.5], ['potato', 0.3], ['cream', 1], ['onion', 0.1], ['butter', 1],
  ] },
  { key: 'gazpacho', category: 'soups', ingredients: [
    ['tomato', 1], ['cucumber', 0.3], ['pepper', 0.2], ['garlic', 1], ['bread', 1],
    ['olive_oil', null], ['vinegar', null],
  ] },
  { key: 'lentil_soup', category: 'soups', ingredients: [
    ['lentils', 0.3], ['carrot', 0.15], ['onion', 0.1], ['celery', 1], ['tomato_paste', 1],
  ] },
  { key: 'broccoli_soup', category: 'soups', ingredients: [
    ['broccoli', 0.5], ['potato', 0.2], ['cream', 1], ['onion', 0.1], ['cheese', 50],
  ] },

  // ── Салаты ─────────────────────────────────────────────
  { key: 'caesar_salad', category: 'salads', ingredients: [
    ['lettuce', 1], ['chicken', 0.3], ['cheese', 50], ['bread', 1], ['mayonnaise', 1],
    ['garlic', 1], ['lemon', 1],
  ] },
  { key: 'greek_salad', category: 'salads', ingredients: [
    ['tomato', 0.4], ['cucumber', 0.3], ['pepper', 0.2], ['onion', 0.05], ['feta', 1],
    ['olive_oil', null],
  ] },
  { key: 'caprese', category: 'salads', ingredients: [
    ['tomato', 0.4], ['mozzarella', 1], ['greens', 1], ['olive_oil', null],
  ] },
  { key: 'tuna_salad', category: 'salads', ingredients: [
    ['tuna_canned', 1], ['lettuce', 1], ['eggs', 2], ['tomato', 0.3], ['corn', 1],
  ] },

  // ── Завтраки ───────────────────────────────────────────
  { key: 'omelette', category: 'breakfasts', ingredients: [
    ['eggs', 4], ['milk', 0.1], ['cheese', 50], ['butter', 1],
  ] },
  { key: 'pancakes', category: 'breakfasts', ingredients: [
    ['flour', 0.25], ['milk', 0.3], ['eggs', 2], ['sugar', 0.03], ['baking_powder', 1], ['butter', 1],
  ] },
  { key: 'oatmeal_berries', category: 'breakfasts', ingredients: [
    ['oats', 0.15], ['milk', 0.4], ['frozen_berries', 1], ['honey', 1],
  ] },
  { key: 'french_toast', category: 'breakfasts', ingredients: [
    ['bread', 1], ['eggs', 2], ['milk', 0.15], ['sugar', 0.02], ['butter', 1],
  ] },
  { key: 'avocado_toast', category: 'breakfasts', ingredients: [
    ['bread', 1], ['avocado', 2], ['eggs', 2], ['lemon', 1],
  ] },

  // ── Выпечка ────────────────────────────────────────────
  { key: 'apple_pie', category: 'baking', ingredients: [
    ['apple', 0.8], ['flour', 0.25], ['sugar', 0.15], ['eggs', 3], ['butter', 1],
  ] },
  // ══ Расширение справочника (v0.20, просьба Vadym 10-04) ═══════════════
  // Без мяса: из 30 прежних блюд 9 уже мясные, и потолок «не больше 10 %
  // мясных» на 113 блюдах — это 11. Рыба и морепродукты мясом не считаются
  // (9 новых). Есть испанские блюда — семья живёт в Валенсии, а продукты для
  // них лежат в любом местном супермаркете.

  // ── Супы ───────────────────────────────────────────────
  { key: 'borscht_veg', category: 'soups', ingredients: [
    ['beet', 0.4], ['cabbage', 0.5], ['potato', 0.4], ['carrot', 0.15], ['onion', 0.1],
    ['tomato_paste', 1], ['garlic', 1], ['greens', 1],
  ] },
  { key: 'cabbage_soup', category: 'soups', ingredients: [
    ['cabbage', 0.5], ['potato', 0.4], ['carrot', 0.1], ['onion', 0.1], ['tomato', 0.2],
    ['sour_cream', 1], ['greens', 1],
  ] },
  { key: 'tomato_soup', category: 'soups', ingredients: [
    ['tomato', 1], ['onion', 0.1], ['garlic', 1], ['cream', 1], ['olive_oil', null], ['greens', 1],
  ] },
  { key: 'green_pea_soup', category: 'soups', ingredients: [
    ['green_peas', 2], ['potato', 0.2], ['onion', 0.1], ['cream', 1], ['butter', 1],
  ] },
  { key: 'cauliflower_soup', category: 'soups', ingredients: [
    ['cauliflower', 1], ['potato', 0.2], ['onion', 0.1], ['milk', 0.3], ['butter', 1],
  ] },
  { key: 'chickpea_spinach_soup', category: 'soups', ingredients: [
    ['chickpeas', 2], ['spinach', 1], ['tomato', 0.3], ['onion', 0.1], ['garlic', 1], ['olive_oil', null],
  ] },
  { key: 'carrot_ginger_soup', category: 'soups', ingredients: [
    ['carrot', 0.6], ['ginger', 1], ['onion', 0.1], ['coconut_milk', 1],
  ] },
  { key: 'leek_potato_soup', category: 'soups', ingredients: [
    ['leek', 2], ['potato', 0.5], ['butter', 1], ['cream', 1],
  ] },
  { key: 'fish_soup', category: 'soups', ingredients: [
    ['hake', 0.5], ['potato', 0.4], ['carrot', 0.1], ['onion', 0.1], ['bay_leaf', 1], ['greens', 1],
  ] },
  { key: 'bean_soup', category: 'soups', ingredients: [
    ['beans', 2], ['potato', 0.3], ['carrot', 0.1], ['onion', 0.1], ['tomato_paste', 1], ['garlic', 1],
  ] },
  { key: 'zucchini_soup', category: 'soups', ingredients: [
    ['zucchini', 0.7], ['potato', 0.2], ['onion', 0.1], ['cream', 1], ['cheese', 50],
  ] },
  { key: 'vegetable_noodle_soup', category: 'soups', ingredients: [
    ['pasta', 1], ['potato', 0.3], ['carrot', 0.1], ['onion', 0.1], ['frozen_vegetables', 1], ['greens', 1],
  ] },
  { key: 'sweet_potato_soup', category: 'soups', ingredients: [
    ['sweet_potato', 0.7], ['coconut_milk', 1], ['onion', 0.1], ['ginger', 1], ['curry', 1],
  ] },
  { key: 'spinach_soup', category: 'soups', ingredients: [
    ['spinach', 2], ['potato', 0.3], ['onion', 0.1], ['cream', 1], ['garlic', 1],
  ] },
  { key: 'salmorejo', category: 'soups', ingredients: [
    ['tomato', 1], ['bread', 1], ['garlic', 1], ['olive_oil', null], ['eggs', 2],
  ] },

  // ── Основные ───────────────────────────────────────────
  { key: 'chickpea_curry', category: 'mains', ingredients: [
    ['chickpeas', 2], ['spinach', 1], ['coconut_milk', 1], ['tomato', 0.3], ['onion', 0.1],
    ['garlic', 1], ['curry', 1], ['rice', 0.3],
  ] },
  { key: 'pasta_pesto', category: 'mains', ingredients: [
    ['pasta', 1], ['pesto', 1], ['cherry_tomato', 1], ['cheese', 40],
  ] },
  { key: 'pasta_tomato_basil', category: 'mains', ingredients: [
    ['pasta', 1], ['tomato', 0.6], ['garlic', 1], ['olive_oil', null], ['greens', 1], ['cheese', 40],
  ] },
  { key: 'mac_cheese', category: 'mains', ingredients: [
    ['pasta', 1], ['cheese', 200], ['milk', 0.4], ['butter', 1], ['flour', 0.03],
  ] },
  { key: 'veg_lasagna', category: 'mains', ingredients: [
    ['pasta', 1], ['zucchini', 0.3], ['eggplant', 0.3], ['spinach', 1], ['tomato_paste', 1],
    ['ricotta', 1], ['mozzarella', 1],
  ] },
  { key: 'eggplant_parmigiana', category: 'mains', ingredients: [
    ['eggplant', 0.8], ['tomato_paste', 1], ['mozzarella', 1], ['cheese', 60], ['greens', 1],
    ['olive_oil', null],
  ] },
  { key: 'stuffed_peppers', category: 'mains', ingredients: [
    ['pepper', 0.8], ['rice', 0.2], ['carrot', 0.1], ['onion', 0.1], ['tomato_paste', 1], ['sour_cream', 1],
  ] },
  { key: 'rice_noodles_vegetables', category: 'mains', ingredients: [
    ['rice_noodles', 1], ['frozen_vegetables', 1], ['soy_sauce', 40], ['garlic', 1], ['ginger', 1],
    ['sesame', 1],
  ] },
  { key: 'tofu_vegetables_rice', category: 'mains', ingredients: [
    ['tofu', 1], ['broccoli', 0.3], ['pepper', 0.2], ['soy_sauce', 40], ['rice', 0.3], ['garlic', 1],
  ] },
  { key: 'buckwheat_mushrooms', category: 'mains', ingredients: [
    ['buckwheat', 0.3], ['mushrooms', 0.4], ['onion', 0.15], ['butter', 1],
  ] },
  { key: 'potato_pancakes', category: 'mains', ingredients: [
    ['potato', 1], ['eggs', 1], ['onion', 0.1], ['flour', 0.05], ['sour_cream', 1], ['oil', null],
  ] },
  { key: 'vegetable_stew', category: 'mains', ingredients: [
    ['potato', 0.5], ['zucchini', 0.3], ['cabbage', 0.5], ['carrot', 0.15], ['onion', 0.1],
    ['tomato_paste', 1],
  ] },
  { key: 'cauliflower_cheese', category: 'mains', ingredients: [
    ['cauliflower', 1], ['cheese', 120], ['milk', 0.3], ['butter', 1], ['flour', 0.03],
  ] },
  { key: 'spanish_tortilla', category: 'mains', ingredients: [
    ['potato', 0.7], ['eggs', 6], ['onion', 0.2], ['olive_oil', null],
  ] },
  { key: 'paella_vegetables', category: 'mains', ingredients: [
    ['rice', 0.4], ['pepper', 0.3], ['green_peas', 1], ['tomato', 0.3], ['onion', 0.1], ['garlic', 1],
    ['paprika', 1], ['olive_oil', null],
  ] },
  { key: 'paella_seafood', category: 'mains', ingredients: [
    ['rice', 0.4], ['shrimp', 1], ['mussels', 0.5], ['pepper', 0.2], ['tomato', 0.3], ['garlic', 1],
    ['paprika', 1], ['olive_oil', null],
  ] },
  { key: 'baked_cod', category: 'mains', ingredients: [
    ['cod', 0.6], ['potato', 0.6], ['tomato', 0.3], ['lemon', 1], ['olive_oil', null], ['greens', 1],
  ] },
  { key: 'fish_cakes', category: 'mains', ingredients: [
    ['hake', 0.6], ['onion', 0.1], ['eggs', 1], ['bread', 1], ['greens', 1], ['oil', null],
  ] },
  { key: 'salmon_bowl', category: 'mains', ingredients: [
    ['salmon', 0.3], ['rice', 0.3], ['avocado', 1], ['cucumber', 0.2], ['soy_sauce', 30], ['sesame', 1],
  ] },
  { key: 'mussels_tomato', category: 'mains', ingredients: [
    ['mussels', 1], ['tomato', 0.5], ['onion', 0.1], ['garlic', 1], ['wine', null], ['greens', 1],
  ] },
  { key: 'garlic_shrimp', category: 'mains', ingredients: [
    ['shrimp', 1], ['garlic', 1], ['olive_oil', null], ['lemon', 1], ['greens', 1], ['bread', 1],
  ] },
  { key: 'falafel', category: 'mains', ingredients: [
    ['chickpeas', 2], ['onion', 0.1], ['garlic', 1], ['greens', 1], ['flour', 0.03], ['lavash', 2],
    ['yogurt', 1],
  ] },
  { key: 'quesadilla', category: 'mains', ingredients: [
    ['tortilla', 1], ['beans', 1], ['cheese', 150], ['pepper', 0.2], ['corn', 1], ['sour_cream', 1],
  ] },
  { key: 'lentil_bolognese', category: 'mains', ingredients: [
    ['pasta', 1], ['lentils', 0.2], ['carrot', 0.1], ['onion', 0.1], ['tomato_paste', 1], ['garlic', 1],
    ['olive_oil', null],
  ] },
  { key: 'pumpkin_risotto', category: 'mains', ingredients: [
    ['rice', 0.3], ['pumpkin', 0.5], ['onion', 0.1], ['butter', 1], ['cheese', 60],
  ] },
  { key: 'couscous_vegetables', category: 'mains', ingredients: [
    ['couscous', 1], ['zucchini', 0.3], ['pepper', 0.2], ['eggplant', 0.2], ['chickpeas', 1],
    ['olive_oil', null],
  ] },
  { key: 'potato_mushroom_bake', category: 'mains', ingredients: [
    ['potato', 1], ['mushrooms', 0.4], ['onion', 0.1], ['sour_cream', 1], ['cheese', 80],
  ] },
  { key: 'braised_cabbage', category: 'mains', ingredients: [
    ['cabbage', 1], ['mushrooms', 0.3], ['carrot', 0.1], ['onion', 0.1], ['tomato_paste', 1],
  ] },

  // ── Салаты ─────────────────────────────────────────────
  { key: 'vinegret', category: 'salads', ingredients: [
    ['beet', 0.4], ['potato', 0.3], ['carrot', 0.15], ['cucumber', 0.2], ['green_peas', 1],
    ['onion', 0.05], ['oil', null],
  ] },
  { key: 'beet_feta_salad', category: 'salads', ingredients: [
    ['beet', 0.4], ['feta', 1], ['lettuce', 1], ['nuts', 1], ['olive_oil', null],
  ] },
  { key: 'coleslaw', category: 'salads', ingredients: [
    ['cabbage', 0.5], ['carrot', 0.15], ['mayonnaise', 1], ['vinegar', null],
  ] },
  { key: 'quinoa_salad', category: 'salads', ingredients: [
    ['quinoa', 1], ['cucumber', 0.2], ['cherry_tomato', 1], ['feta', 1], ['lemon', 1], ['greens', 1],
  ] },
  { key: 'tabbouleh', category: 'salads', ingredients: [
    ['bulgur', 1], ['tomato', 0.3], ['cucumber', 0.2], ['greens', 2], ['lemon', 1], ['olive_oil', null],
  ] },
  { key: 'chickpea_salad', category: 'salads', ingredients: [
    ['chickpeas', 2], ['cucumber', 0.2], ['tomato', 0.3], ['onion', 0.05], ['greens', 1], ['olive_oil', null],
  ] },
  { key: 'avocado_shrimp_salad', category: 'salads', ingredients: [
    ['avocado', 2], ['shrimp', 1], ['lettuce', 1], ['cherry_tomato', 1], ['lemon', 1],
  ] },
  { key: 'warm_potato_salad', category: 'salads', ingredients: [
    ['potato', 0.8], ['onion', 0.05], ['mustard', 1], ['greens', 1], ['oil', null], ['vinegar', null],
  ] },
  { key: 'cucumber_tomato_salad', category: 'salads', ingredients: [
    ['cucumber', 0.3], ['tomato', 0.4], ['onion', 0.05], ['sour_cream', 1], ['greens', 1],
  ] },
  { key: 'carrot_garlic_salad', category: 'salads', ingredients: [
    ['carrot', 0.4], ['garlic', 1], ['mayonnaise', 1], ['raisins', 1],
  ] },
  { key: 'lentil_feta_salad', category: 'salads', ingredients: [
    ['lentils', 0.2], ['feta', 1], ['pepper', 0.2], ['onion', 0.05], ['greens', 1], ['olive_oil', null],
  ] },
  { key: 'pasta_salad', category: 'salads', ingredients: [
    ['pasta', 1], ['cherry_tomato', 1], ['mozzarella', 1], ['pesto', 1], ['olives', 1],
  ] },
  { key: 'ensalada_mixta', category: 'salads', ingredients: [
    ['lettuce', 1], ['tomato', 0.3], ['onion', 0.05], ['tuna_canned', 1], ['eggs', 2], ['olives', 1],
    ['corn', 1],
  ] },

  // ── Завтраки ───────────────────────────────────────────
  { key: 'syrniki', category: 'breakfasts', ingredients: [
    ['cottage_cheese', 2], ['eggs', 1], ['flour', 0.06], ['sugar', 0.03], ['sour_cream', 1], ['oil', null],
  ] },
  { key: 'shakshuka', category: 'breakfasts', ingredients: [
    ['eggs', 4], ['tomato', 0.6], ['pepper', 0.2], ['onion', 0.1], ['garlic', 1], ['paprika', 1],
    ['bread', 1],
  ] },
  { key: 'buckwheat_porridge', category: 'breakfasts', ingredients: [
    ['buckwheat', 0.2], ['milk', 0.5], ['butter', 1],
  ] },
  { key: 'rice_porridge', category: 'breakfasts', ingredients: [
    ['rice', 0.15], ['milk', 0.7], ['sugar', 0.02], ['butter', 1],
  ] },
  { key: 'yogurt_fruit_bowl', category: 'breakfasts', ingredients: [
    ['yogurt', 2], ['banana', 0.3], ['frozen_berries', 1], ['nuts', 1], ['honey', 1],
  ] },
  { key: 'banana_pancakes', category: 'breakfasts', ingredients: [
    ['banana', 0.3], ['eggs', 2], ['flour', 0.1], ['milk', 0.1], ['baking_powder', 1],
  ] },
  { key: 'eggs_vegetables', category: 'breakfasts', ingredients: [
    ['eggs', 4], ['tomato', 0.2], ['pepper', 0.15], ['onion', 0.05], ['greens', 1], ['butter', 1],
  ] },
  { key: 'crepes', category: 'breakfasts', ingredients: [
    ['flour', 0.25], ['milk', 0.5], ['eggs', 2], ['sugar', 0.03], ['butter', 1], ['oil', null],
  ] },
  { key: 'berry_smoothie', category: 'breakfasts', ingredients: [
    ['frozen_berries', 1], ['banana', 0.2], ['yogurt', 1], ['honey', 1],
  ] },
  { key: 'cottage_cheese_bake', category: 'breakfasts', ingredients: [
    ['cottage_cheese', 2], ['eggs', 2], ['sugar', 0.05], ['flour', 0.03], ['sour_cream', 1], ['raisins', 1],
  ] },
  { key: 'spinach_frittata', category: 'breakfasts', ingredients: [
    ['eggs', 5], ['spinach', 1], ['cheese', 60], ['onion', 0.05], ['milk', 0.1],
  ] },
  { key: 'pan_con_tomate', category: 'breakfasts', ingredients: [
    ['bread', 1], ['tomato', 0.3], ['garlic', 1], ['olive_oil', null],
  ] },

  // ── Выпечка ────────────────────────────────────────────
  { key: 'banana_bread', category: 'baking', ingredients: [
    ['banana', 0.4], ['flour', 0.25], ['eggs', 2], ['sugar', 0.1], ['butter', 1], ['baking_powder', 1],
  ] },
  { key: 'carrot_cake', category: 'baking', ingredients: [
    ['carrot', 0.3], ['flour', 0.25], ['eggs', 3], ['sugar', 0.15], ['oil', null], ['cinnamon', 1],
    ['nuts', 1], ['baking_powder', 1],
  ] },
  { key: 'spinach_feta_quiche', category: 'baking', ingredients: [
    ['puff_pastry', 1], ['spinach', 1], ['feta', 1], ['eggs', 3], ['cream', 1],
  ] },
  { key: 'charlotte', category: 'baking', ingredients: [
    ['apple', 0.6], ['eggs', 4], ['flour', 0.15], ['sugar', 0.15], ['baking_powder', 1],
  ] },
  { key: 'chocolate_muffins', category: 'baking', ingredients: [
    ['flour', 0.2], ['cocoa', 1], ['eggs', 2], ['sugar', 0.12], ['milk', 0.15], ['butter', 1],
    ['baking_powder', 1],
  ] },
  { key: 'focaccia', category: 'baking', ingredients: [
    ['flour', 0.5], ['yeast', 1], ['olive_oil', null], ['cherry_tomato', 1], ['olives', 1],
  ] },
  { key: 'cheese_spinach_pastries', category: 'baking', ingredients: [
    ['puff_pastry', 1], ['cheese', 150], ['spinach', 1], ['eggs', 1],
  ] },
  { key: 'oat_cookies', category: 'baking', ingredients: [
    ['oats', 0.2], ['flour', 0.1], ['butter', 1], ['sugar', 0.1], ['eggs', 1], ['raisins', 1],
  ] },

  // ── Закуски и гарниры (категория «Прочее») ─────────────
  { key: 'hummus', category: 'other', ingredients: [
    ['chickpeas', 2], ['lemon', 1], ['garlic', 1], ['sesame', 1], ['olive_oil', null], ['carrot', 0.2],
    ['cucumber', 0.2],
  ] },
  { key: 'guacamole', category: 'other', ingredients: [
    ['avocado', 3], ['tomato', 0.2], ['onion', 0.05], ['lemon', 1], ['chips', 1],
  ] },
  { key: 'roasted_vegetables', category: 'other', ingredients: [
    ['potato', 0.5], ['carrot', 0.2], ['pepper', 0.2], ['zucchini', 0.3], ['onion', 0.1], ['olive_oil', null],
  ] },
  { key: 'mashed_potatoes', category: 'other', ingredients: [
    ['potato', 1], ['milk', 0.2], ['butter', 1],
  ] },
  { key: 'patatas_bravas', category: 'other', ingredients: [
    ['potato', 0.8], ['tomato_paste', 1], ['paprika', 1], ['garlic', 1], ['mayonnaise', 1],
    ['olive_oil', null],
  ] },
  { key: 'bruschetta', category: 'other', ingredients: [
    ['bread', 1], ['tomato', 0.4], ['garlic', 1], ['greens', 1], ['olive_oil', null],
  ] },
  { key: 'stuffed_mushrooms', category: 'other', ingredients: [
    ['mushrooms', 0.4], ['cheese', 100], ['garlic', 1], ['greens', 1],
  ] },
];

/**
 * Готовые наборы (D-054). Правятся и удаляются как свои: при первом касании
 * набор заводится в кухне, недостающие блюда и продукты создаются.
 */
export interface LibrarySet {
  key: string;
  dishes: string[];
  /** Продукты без блюда: [ключ продукта, количество или null] */
  products: Array<[string, number | null]>;
}

export const SET_LIBRARY: LibrarySet[] = [
  {
    key: 'light_week',
    dishes: ['greek_salad', 'caprese', 'pumpkin_soup', 'broccoli_soup', 'baked_salmon', 'minestrone', 'ratatouille'],
    products: [],
  },
  {
    key: 'picnic',
    dishes: ['greek_salad', 'caprese'],
    products: [
      ['sausages', 2], ['bread', 1], ['water', 3], ['juice', 2], ['chips', 2],
      ['charcoal', 1], ['napkins', 1], ['disposable_tableware', 1],
    ],
  },
  {
    key: 'quick_dinners',
    dishes: ['pasta_carbonara', 'shrimp_pasta', 'chicken_creamy_mushrooms', 'caesar_salad', 'tuna_salad'],
    products: [],
  },
  {
    key: 'breakfast_week',
    dishes: ['omelette', 'pancakes', 'oatmeal_berries', 'french_toast', 'avocado_toast'],
    products: [['coffee', 1], ['juice', 1]],
  },
];
