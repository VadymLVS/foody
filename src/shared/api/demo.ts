import type { Category, DeckCard, DishIngredient, PlanNeedRow, Product, Unit } from '@/shared/db/types';
import type { DishWithStatus, NewProduct, ProductPatch, Repo, RealtimeEvent } from './repo';
import { productLabel } from '@/shared/lib/i18n';

/**
 * Демо-репозиторий. Включается сам при отсутствии ключей и переживает
 * перезагрузку через localStorage. Тот же режим понадобится ревьюеру
 * App Store (Guideline 2.1).
 */

const KEY = 'pantrysync:demo:v2';
export const DEMO_KITCHEN_ID = 'demo-kitchen';
const DEMO_USER = 'demo-user';

const CATEGORIES: Category[] = [
  { id: 'c-veg',   kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'vegetables', name: null, sort_order: 10 },
  { id: 'c-fruit', kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'fruits',     name: null, sort_order: 20 },
  { id: 'c-milk',  kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'dairy',      name: null, sort_order: 30 },
  { id: 'c-meat',  kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'meat_fish',  name: null, sort_order: 40 },
  { id: 'c-bread', kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'bakery',     name: null, sort_order: 50 },
  { id: 'c-dry',   kitchen_id: DEMO_KITCHEN_ID, kind: 'product', key: 'pantry',     name: null, sort_order: 60 },
  { id: 'dc-soup', kitchen_id: DEMO_KITCHEN_ID, kind: 'dish',    key: 'soups',      name: null, sort_order: 10 },
  { id: 'dc-main', kitchen_id: DEMO_KITCHEN_ID, kind: 'dish',    key: 'mains',      name: null, sort_order: 20 },
  { id: 'dc-sal',  kitchen_id: DEMO_KITCHEN_ID, kind: 'dish',    key: 'salads',     name: null, sort_order: 30 },
  { id: 'dc-brk',  kitchen_id: DEMO_KITCHEN_ID, kind: 'dish',    key: 'breakfasts', name: null, sort_order: 40 },
  { id: 'dc-bak',  kitchen_id: DEMO_KITCHEN_ID, kind: 'dish',    key: 'baking',     name: null, sort_order: 50 },
];

// [libraryKey, categoryId, unit, quantity, inStock]
const SEED: Array<[string, string, Unit, number, boolean]> = [
  ['milk', 'c-milk', 'l', 2, true],
  ['cheese', 'c-milk', 'g', 250, true],
  ['eggs', 'c-milk', 'pcs', 10, true],
  ['sour_cream', 'c-milk', 'pack', 0, false],
  ['bread', 'c-bread', 'pcs', 1, true],
  ['potato', 'c-veg', 'kg', 2, true],
  ['onion', 'c-veg', 'kg', 1, true],
  ['carrot', 'c-veg', 'kg', 0, false],
  ['tomato', 'c-veg', 'kg', 0, false],
  ['cucumber', 'c-veg', 'kg', 0, false],
  ['cabbage', 'c-veg', 'pcs', 1, true],
  ['apple', 'c-fruit', 'kg', 1.5, true],
  ['chicken', 'c-meat', 'kg', 0, false],
  ['mince', 'c-meat', 'kg', 0.5, true],
  ['rice', 'c-dry', 'kg', 1, true],
  ['pasta', 'c-dry', 'pack', 0, false],
  ['oil', 'c-dry', 'l', 1, true],
  ['flour', 'c-dry', 'kg', 0, false],
];

type SeedIngredient = [productId: string | null, name: string, qty: number | null];

const DISHES: Array<{
  id: string; name: string; cat: string; lib: string | null;
  w: number | null; h: number | null; ing: SeedIngredient[];
}> = [
  { id: 'd-1', name: 'Омлет', cat: 'dc-brk', lib: 'omlet', w: 1200, h: 1200,
    ing: [['p-2', 'Яйца', 3], ['p-0', 'Молоко', 0.2], ['p-1', 'Сыр', 50]] },
  { id: 'd-2', name: 'Жареная картошка', cat: 'dc-main', lib: 'zharenaya_kartoshka', w: 1200, h: 900,
    ing: [['p-5', 'Картошка', 1], ['p-6', 'Лук', 0.2], ['p-16', 'Масло растительное', null]] },
  { id: 'd-3', name: 'Плов', cat: 'dc-main', lib: 'plov', w: 900, h: 1200,
    ing: [['p-14', 'Рис', 0.5], ['p-6', 'Лук', 0.2], ['p-7', 'Морковь', 0.3], ['p-13', 'Фарш', 0.5]] },
  { id: 'd-4', name: 'Паста карбонара', cat: 'dc-main', lib: 'pasta_carbonara', w: 1200, h: 1000,
    ing: [['p-15', 'Макароны', 1], ['p-2', 'Яйца', 2], ['p-1', 'Сыр', 80]] },
  { id: 'd-5', name: 'Борщ', cat: 'dc-soup', lib: 'borsch', w: 1200, h: 1200,
    ing: [['p-5', 'Картошка', 0.5], ['p-6', 'Лук', 0.2], ['p-7', 'Морковь', 0.3], ['p-8', 'Помидоры', 1]] },
  { id: 'd-6', name: 'Куриный суп', cat: 'dc-soup', lib: null, w: null, h: null,
    ing: [['p-12', 'Курица', 1], ['p-5', 'Картошка', 0.4], ['p-7', 'Морковь', 0.2]] },
  { id: 'd-7', name: 'Греческий салат', cat: 'dc-sal', lib: 'greek_salad', w: 1000, h: 1200,
    ing: [['p-8', 'Помидоры', 0.5], ['p-9', 'Огурцы', 0.3], ['p-1', 'Сыр', 100]] },
  { id: 'd-8', name: 'Шарлотка', cat: 'dc-bak', lib: 'sharlotka', w: 1200, h: 1500,
    ing: [['p-11', 'Яблоки', 0.6], ['p-2', 'Яйца', 3], ['p-17', 'Мука', 0.2]] },
];

function seedProducts(): Product[] {
  const now = new Date().toISOString();
  return SEED.map(([lib, cat, unit, quantity, inStock], i) => ({
    id: `p-${i}`,
    kitchen_id: DEMO_KITCHEN_ID,
    name: productLabel(lib, lib),
    category_id: cat,
    unit, quantity, in_stock: inStock,
    library_key: lib,
    deleted_at: null,
    updated_by: DEMO_USER,
    updated_at: now,
  }));
}

interface State { products: Product[]; favorites: string[]; planned: string[]; deletedDishes: string[] }

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch { /* приватный режим */ }
  return { products: seedProducts(), favorites: ['d-3'], planned: ['d-5'], deletedDishes: [] };
}

let state: State = load();

function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

const listeners = new Set<(e: RealtimeEvent) => void>();
const emit = (productId: string) => listeners.forEach((f) => f({ productId, updatedBy: DEMO_USER }));
const delay = () => new Promise((r) => setTimeout(r, 100));

const ingredientsOf = (dishId: string): DishIngredient[] => {
  const dish = DISHES.find((d) => d.id === dishId);
  return (dish?.ing ?? []).map(([pid, name, qty], i) => ({
    id: `${dishId}-i${i}`, dish_id: dishId, product_id: pid, product_name: name, quantity: qty,
  }));
};

function statusOf(dishId: string) {
  const stock = new Set(state.products.filter((p) => p.in_stock && !p.deleted_at).map((p) => p.id));
  const missing = ingredientsOf(dishId).filter((i) => !i.product_id || !stock.has(i.product_id));
  return { missingCount: missing.length, missingNames: missing.map((m) => m.product_name) };
}

const activeDishes = () => DISHES.filter((d) => !state.deletedDishes.includes(d.id));

export const demoRepo: Repo = {
  isDemo: true,
  currentUserId: () => DEMO_USER,

  async listCategories() { await delay(); return [...CATEGORIES]; },
  async listProducts() { await delay(); return state.products.filter((p) => !p.deleted_at); },

  async listSuggestions() {
    return [
      { key: 'kefir', name: productLabel('kefir', 'Кефир'), categoryKey: 'dairy', unit: 'l' as Unit },
      { key: 'butter', name: productLabel('butter', 'Масло'), categoryKey: 'dairy', unit: 'pack' as Unit },
      { key: 'garlic', name: productLabel('garlic', 'Чеснок'), categoryKey: 'vegetables', unit: 'pcs' as Unit },
      { key: 'banana', name: productLabel('banana', 'Бананы'), categoryKey: 'fruits', unit: 'kg' as Unit },
      { key: 'buckwheat', name: productLabel('buckwheat', 'Гречка'), categoryKey: 'pantry', unit: 'kg' as Unit },
      { key: 'sugar', name: productLabel('sugar', 'Сахар'), categoryKey: 'pantry', unit: 'kg' as Unit },
    ];
  },

  async createProduct(kitchenId, input: NewProduct) {
    await delay();
    if (state.products.some((p) => !p.deleted_at && p.name.toLowerCase() === input.name.toLowerCase())) {
      throw new Error('duplicate_product');
    }
    const product: Product = {
      id: `p-${Date.now()}`, kitchen_id: kitchenId, name: input.name,
      category_id: input.categoryId, unit: input.unit, quantity: 0,
      in_stock: input.inStock, library_key: input.libraryKey ?? null,
      deleted_at: null, updated_by: DEMO_USER, updated_at: new Date().toISOString(),
    };
    state.products = [...state.products, product];
    persist(); emit(product.id);
    return product;
  },

  async updateProduct(id, patch: ProductPatch) {
    await delay();
    state.products = state.products.map((p) =>
      p.id === id ? { ...p, ...patch, updated_at: new Date().toISOString() } : p);
    persist(); emit(id);
  },

  async softDeleteProduct(id) {
    await delay();
    state.products = state.products.map((p) =>
      p.id === id ? { ...p, deleted_at: new Date().toISOString() } : p);
    persist(); emit(id);
  },

  async restoreProduct(id) {
    await delay();
    state.products = state.products.map((p) => (p.id === id ? { ...p, deleted_at: null } : p));
    persist(); emit(id);
  },

  subscribeProducts(_k, onChange) {
    listeners.add(onChange);
    return () => listeners.delete(onChange);
  },

  async listDishes(kitchenId) {
    await delay();
    return activeDishes().map<DishWithStatus>((d) => ({
      id: d.id, kitchen_id: kitchenId, name: d.name, category_id: d.cat,
      image_path: null, library_key: d.lib, image_w: d.w, image_h: d.h,
      deleted_at: null, ingredients: ingredientsOf(d.id),
      isFavorite: state.favorites.includes(d.id),
      isPlanned: state.planned.includes(d.id),
      ...statusOf(d.id),
    }));
  },

  async deleteDish(id) {
    await delay();
    state.deletedDishes = [...state.deletedDishes, id];
    state.planned = state.planned.filter((p) => p !== id);
    persist();
  },

  async toggleFavorite(dishId, next) {
    state.favorites = next
      ? [...new Set([...state.favorites, dishId])]
      : state.favorites.filter((f) => f !== dishId);
    persist();
  },

  async loadDeck() {
    await delay();
    return activeDishes()
      .filter((d) => !state.planned.includes(d.id))
      .map<DeckCard>((d) => {
        const s = statusOf(d.id);
        return {
          dish_id: d.id, name: d.name, image_path: null, library_key: d.lib,
          image_w: d.w, image_h: d.h,
          missing_count: s.missingCount, missing_names: s.missingNames,
          is_favorite: state.favorites.includes(d.id),
        };
      })
      .filter((c) => c.missing_count <= 2)
      .sort((a, b) => Number(a.missing_count > 0) - Number(b.missing_count > 0));
  },

  async listPlanned() { return [...state.planned]; },

  async addToPlan(_k, dishId) {
    state.planned = [...new Set([...state.planned, dishId])];
    persist();
  },

  async removeFromPlan(_k, dishId) {
    state.planned = state.planned.filter((p) => p !== dishId);
    persist();
  },

  async planNeeds() {
    await delay();
    const byProduct = new Map<string, PlanNeedRow>();
    for (const dishId of state.planned) {
      const dish = DISHES.find((d) => d.id === dishId);
      if (!dish) continue;
      for (const ing of ingredientsOf(dishId)) {
        const product = state.products.find((p) => p.id === ing.product_id);
        if (!product || product.in_stock || product.deleted_at) continue;
        const row = byProduct.get(product.id) ?? {
          product_id: product.id, product_name: product.name, unit: product.unit,
          total_quantity: null, dish_count: 0, dishes: [],
        };
        row.dish_count += 1;
        row.dishes.push({ dish: dish.name, quantity: ing.quantity, owner: null });
        if (ing.quantity != null) row.total_quantity = (row.total_quantity ?? 0) + ing.quantity;
        byProduct.set(product.id, row);
      }
    }
    return [...byProduct.values()];
  },
};
