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
};

export interface LibraryDish {
  key: string;
  category: 'soups' | 'mains' | 'salads' | 'breakfasts' | 'baking';
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
];
