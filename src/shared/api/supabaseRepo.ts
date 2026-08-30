import { supabase, hasSupabaseCredentials } from './supabase';
import type { Category, DeckCard, DishIngredient, PlanNeedRow, Product, Unit } from '@/shared/db/types';
import type { DishWithStatus, NewProduct, ProductPatch, Repo, RealtimeEvent } from './repo';
import { productLabel } from '@/shared/lib/i18n';

let cachedUserId = '';

if (hasSupabaseCredentials) {
  void supabase.auth.getUser().then(({ data }) => { cachedUserId = data.user?.id ?? ''; });
  supabase.auth.onAuthStateChange((_e, session) => { cachedUserId = session?.user?.id ?? ''; });
}

function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  if (r.data === null) throw new Error('empty_response');
  return r.data;
}

export const supabaseRepo: Repo = {
  isDemo: false,
  currentUserId: () => cachedUserId,

  async listCategories(kitchenId) {
    return unwrap(
      await supabase
        .from('categories')
        .select('id, kitchen_id, kind, key, name, sort_order')
        .or(`kitchen_id.eq.${kitchenId},kitchen_id.is.null`)
        .order('sort_order'),
    ) as Category[];
  },

  async listProducts(kitchenId) {
    return unwrap(
      await supabase
        .from('products')
        .select('id, kitchen_id, name, category_id, unit, quantity, in_stock, library_key, deleted_at, updated_by, updated_at')
        .eq('kitchen_id', kitchenId)
        .is('deleted_at', null),
    ) as Product[];
  },

  async listSuggestions() {
    const rows = unwrap(
      await supabase.from('product_suggestions').select('key, category_key, unit'),
    ) as Array<{ key: string; category_key: string | null; unit: Unit }>;
    // Подпись берётся из словаря по ключу — так справочник работает на любом языке.
    return rows.map((r) => ({
      key: r.key,
      name: productLabel(r.key, r.key),
      categoryKey: r.category_key,
      unit: r.unit,
    }));
  },

  async createProduct(kitchenId, input: NewProduct) {
    // created_by обязателен: политика products_insert требует его равенства auth.uid()
    return unwrap(
      await supabase.from('products').insert({
        kitchen_id: kitchenId,
        name: input.name,
        category_id: input.categoryId,
        unit: input.unit,
        in_stock: input.inStock,
        library_key: input.libraryKey ?? null,
        created_by: cachedUserId,
        updated_by: cachedUserId,
      }).select().single(),
    ) as Product;
  },

  async updateProduct(id, patch: ProductPatch) {
    const { error } = await supabase
      .from('products').update({ ...patch, updated_by: cachedUserId }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async softDeleteProduct(id) {
    const { error } = await supabase.from('products')
      .update({ deleted_at: new Date().toISOString(), updated_by: cachedUserId }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async restoreProduct(id) {
    const { error } = await supabase.from('products')
      .update({ deleted_at: null, updated_by: cachedUserId }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  subscribeProducts(kitchenId, onChange: (e: RealtimeEvent) => void) {
    const channel = supabase
      .channel(`kitchen:${kitchenId}:products`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'products', filter: `kitchen_id=eq.${kitchenId}` },
        (payload: { new?: Partial<Product>; old?: Partial<Product> }) => {
          const row = payload.new ?? payload.old;
          if (!row?.id) return;
          onChange({ productId: row.id, updatedBy: row.updated_by ?? null });
        })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  },

  async listDishes(kitchenId) {
    const rows = unwrap(
      await supabase.from('dishes')
        .select('id, kitchen_id, name, category_id, image_path, library_key, image_w, image_h, deleted_at, dish_ingredients(id, dish_id, product_id, product_name, quantity)')
        .eq('kitchen_id', kitchenId)
        .is('deleted_at', null),
    ) as Array<Omit<DishWithStatus, 'missingCount' | 'missingNames' | 'ingredients' | 'isFavorite' | 'isPlanned'>
      & { dish_ingredients: DishIngredient[] }>;

    // Готовность считаем на клиенте: отдельный запрос дешевле джойна по всем блюдам
    const stock = new Set(
      (unwrap(await supabase.from('products').select('id')
        .eq('kitchen_id', kitchenId).eq('in_stock', true).is('deleted_at', null),
      ) as Array<{ id: string }>).map((p) => p.id),
    );

    const favorites = new Set(
      (unwrap(await supabase.from('dish_favorites').select('dish_id')) as Array<{ dish_id: string }>)
        .map((f) => f.dish_id),
    );

    const planned = new Set(
      (unwrap(await supabase.from('planned_dishes').select('dish_id')
        .eq('kitchen_id', kitchenId).eq('user_id', cachedUserId),
      ) as Array<{ dish_id: string }>).map((p) => p.dish_id),
    );

    return rows.map<DishWithStatus>((row) => {
      const ingredients = row.dish_ingredients ?? [];
      const missing = ingredients.filter((i) => !i.product_id || !stock.has(i.product_id));
      return {
        ...row,
        ingredients,
        missingCount: missing.length,
        missingNames: missing.map((m) => m.product_name),
        isFavorite: favorites.has(row.id),
        isPlanned: planned.has(row.id),
      };
    });
  },

  async deleteDish(id) {
    const { error } = await supabase.from('dishes')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async toggleFavorite(dishId, next) {
    const { error } = next
      ? await supabase.from('dish_favorites').insert({ dish_id: dishId, user_id: cachedUserId })
      : await supabase.from('dish_favorites').delete()
          .eq('dish_id', dishId).eq('user_id', cachedUserId);
    if (error) throw new Error(error.message);
  },

  async loadDeck(kitchenId) {
    // Порядок и отбор колоды считает база одним запросом (D-020)
    return unwrap(
      await supabase.rpc('swipe_deck', { p_kitchen: kitchenId, p_limit: 20 }),
    ) as DeckCard[];
  },

  async listPlanned(kitchenId) {
    const rows = unwrap(
      await supabase.from('planned_dishes').select('dish_id')
        .eq('kitchen_id', kitchenId).eq('user_id', cachedUserId),
    ) as Array<{ dish_id: string }>;
    return rows.map((r) => r.dish_id);
  },

  async addToPlan(kitchenId, dishId) {
    const { error } = await supabase.from('planned_dishes')
      .upsert({ kitchen_id: kitchenId, user_id: cachedUserId, dish_id: dishId },
              { onConflict: 'kitchen_id,user_id,dish_id' });
    if (error) throw new Error(error.message);
  },

  async removeFromPlan(kitchenId, dishId) {
    const { error } = await supabase.from('planned_dishes').delete()
      .eq('kitchen_id', kitchenId).eq('user_id', cachedUserId).eq('dish_id', dishId);
    if (error) throw new Error(error.message);
  },

  async planNeeds(kitchenId) {
    return unwrap(await supabase.rpc('plan_needs', { p_kitchen: kitchenId })) as PlanNeedRow[];
  },
};
