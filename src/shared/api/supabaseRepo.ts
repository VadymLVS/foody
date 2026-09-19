import { supabase, hasSupabaseCredentials } from './supabase';
import type { Category, DeckCard, DishIngredient, PlanNeedRow, Product, Unit } from '@/shared/db/types';
import type { DishSet, DishWithStatus, NewDish, NewProduct, ProductPatch, Repo, RealtimeEvent } from './repo';
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
        // Только категории кухни. Системные строки (kitchen_id is null) —
        // шаблон, который create_kitchen копирует внутрь кухни; если тянуть
        // и их, каждая категория показывается дважды.
        .eq('kitchen_id', kitchenId)
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

  async createProducts(kitchenId, inputs: NewProduct[]) {
    if (inputs.length === 0) return [];

    /*
     * Раньше здесь был upsert с onConflict 'kitchen_id,name'. Такого ограничения
     * в схеме нет: уникальный индекс объявлен по (kitchen_id, lower(name)) и только
     * для неудалённых строк. Postgres отвергал запрос целиком, а ошибка никуда
     * не выводилась, поэтому карусель молча ничего не сохраняла (backlog п. 1).
     *
     * Теперь: заранее отсеиваем имена, которые уже есть в кухне, и дубли внутри
     * самой пачки, затем обычный insert одним запросом.
     */
    const existing = unwrap(
      await supabase.from('products').select('name')
        .eq('kitchen_id', kitchenId).is('deleted_at', null),
    ) as Array<{ name: string }>;
    const taken = new Set(existing.map((p) => p.name.trim().toLowerCase()));

    const fresh = inputs.filter((input) => {
      const key = input.name.trim().toLowerCase();
      if (taken.has(key)) return false;
      taken.add(key);
      return true;
    });
    if (fresh.length === 0) return [];

    const row = (input: NewProduct) => ({
      kitchen_id: kitchenId,
      name: input.name.trim(),
      category_id: input.categoryId,
      unit: input.unit,
      in_stock: input.inStock,
      library_key: input.libraryKey ?? null,
      created_by: cachedUserId,
      updated_by: cachedUserId,
    });

    const { data, error } = await supabase.from('products').insert(fresh.map(row)).select();
    if (!error) return (data ?? []) as Product[];

    // 23505 — нарушение уникальности: кто-то добавил тот же продукт между нашей
    // проверкой и вставкой (например, Алина в ту же секунду). Досылаем по одному,
    // пропуская дубли, чтобы не терять всю пачку из-за одной строки.
    if (error.code !== '23505') throw new Error(error.message);
    const created: Product[] = [];
    for (const input of fresh) {
      const single = await supabase.from('products').insert(row(input)).select().single();
      if (single.error) {
        if (single.error.code === '23505') continue;
        throw new Error(single.error.message);
      }
      created.push(single.data as Product);
    }
    return created;
  },

  async setInStock(ids: string[], inStock: boolean) {
    if (ids.length === 0) return;
    const { error } = await supabase.from('products')
      .update({ in_stock: inStock, updated_by: cachedUserId }).in('id', ids);
    if (error) throw new Error(error.message);
  },

  async countQuantifiedUsage(productId: string) {
    const { count, error } = await supabase.from('dish_ingredients')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .not('quantity', 'is', null);
    if (error) throw new Error(error.message);
    return count ?? 0;
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
      /*
       * Суффикс обязателен. Supabase на channel() с уже существующим именем
       * возвращает тот же канал, а добавить обработчик к подписанному каналу
       * нельзя — приложение падало при второй подписке (backlog п. 7).
       * Подписка теперь живёт в одном месте (useProductsRealtime), суффикс —
       * страховка на случай, если её когда-нибудь вызовут дважды.
       */
      .channel(`kitchen:${kitchenId}:products:${Math.random().toString(36).slice(2, 10)}`)
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
        .is('deleted_at', null)
        // Стабильный порядок: без него кладка перестраивалась после каждого выбора (п. 17)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true }),
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

  async createDish(kitchenId, input: NewDish) {
    const dish = unwrap(
      await supabase.from('dishes').insert({
        kitchen_id: kitchenId,
        name: input.name.trim(),
        category_id: input.categoryId,
        library_key: input.libraryKey ?? null,
        created_by: cachedUserId,
      }).select('id').single(),
    ) as { id: string };

    if (input.ingredients.length > 0) {
      const { error } = await supabase.from('dish_ingredients').insert(
        input.ingredients.map((ingredient) => ({
          dish_id: dish.id,
          product_id: ingredient.productId,
          product_name: ingredient.productName,
          quantity: ingredient.quantity,
        })),
      );
      if (error) {
        // Блюдо без состава бесполезно и сбивает счётчики готовности — откатываем
        await supabase.from('dishes').delete().eq('id', dish.id);
        throw new Error(error.message);
      }
    }
    return dish.id;
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
    // ignoreDuplicates: блюдо уже в плане (например, из набора) — оставляем как есть.
    // Обычный upsert перезаписал бы строку и требовал бы политики на update.
    const { error } = await supabase.from('planned_dishes')
      .upsert({ kitchen_id: kitchenId, user_id: cachedUserId, dish_id: dishId },
              { onConflict: 'kitchen_id,user_id,dish_id', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  },

  async removeFromPlan(kitchenId, dishId) {
    const { error } = await supabase.from('planned_dishes').delete()
      .eq('kitchen_id', kitchenId).eq('user_id', cachedUserId).eq('dish_id', dishId);
    if (error) throw new Error(error.message);
  },

  async listSets(kitchenId) {
    const rows = unwrap(
      await supabase.from('dish_sets')
        .select('id, name, library_key, deleted_at, dish_set_dishes(dish_id), dish_set_products(product_id, quantity, products(name, unit, deleted_at))')
        .eq('kitchen_id', kitchenId)
        .order('created_at', { ascending: true }),
      // Связь «многие к одному» приходит объектом, а генератор типов считает её массивом
    ) as unknown as Array<{
      id: string; name: string; library_key: string | null; deleted_at: string | null;
      dish_set_dishes: Array<{ dish_id: string }>;
      dish_set_products: Array<{
        product_id: string; quantity: number | null;
        products: { name: string; unit: Unit; deleted_at: string | null } | null;
      }>;
    }>;

    const planned = unwrap(
      await supabase.from('planned_sets').select('id, set_id, created_at')
        .eq('kitchen_id', kitchenId).eq('user_id', cachedUserId),
    ) as Array<{ id: string; set_id: string; created_at: string }>;
    const plannedBySet = new Map(planned.map((p) => [p.set_id, p]));

    return {
      usedLibraryKeys: rows.flatMap((r) => (r.library_key ? [r.library_key] : [])),
      sets: rows.filter((r) => !r.deleted_at).map<DishSet>((r) => ({
        id: r.id,
        name: r.name,
        libraryKey: r.library_key,
        dishIds: r.dish_set_dishes.map((d) => d.dish_id),
        products: r.dish_set_products
          .filter((p) => p.products && !p.products.deleted_at)
          .map((p) => ({
            productId: p.product_id,
            productName: p.products!.name,
            unit: p.products!.unit,
            quantity: p.quantity === null ? null : Number(p.quantity),
          })),
        plannedSetId: plannedBySet.get(r.id)?.id ?? null,
        plannedAt: plannedBySet.get(r.id)?.created_at ?? null,
      })),
    };
  },

  async saveSet(kitchenId, input, id) {
    let setId = id;
    if (setId) {
      const { error } = await supabase.from('dish_sets').update({ name: input.name.trim() }).eq('id', setId);
      if (error) throw new Error(error.message);
      // Состав заменяется целиком: так проще, чем сравнивать старое и новое
      const d = await supabase.from('dish_set_dishes').delete().eq('set_id', setId);
      if (d.error) throw new Error(d.error.message);
      const p = await supabase.from('dish_set_products').delete().eq('set_id', setId);
      if (p.error) throw new Error(p.error.message);
    } else {
      const created = unwrap(
        await supabase.from('dish_sets').insert({
          kitchen_id: kitchenId, name: input.name.trim(),
          library_key: input.libraryKey ?? null, created_by: cachedUserId,
        }).select('id').single(),
      ) as { id: string };
      setId = created.id;
    }

    if (input.dishIds.length > 0) {
      const { error } = await supabase.from('dish_set_dishes')
        .insert(input.dishIds.map((dishId) => ({ set_id: setId, dish_id: dishId })));
      if (error) throw new Error(error.message);
    }
    if (input.products.length > 0) {
      const { error } = await supabase.from('dish_set_products')
        .insert(input.products.map((p) => ({ set_id: setId, product_id: p.productId, quantity: p.quantity })));
      if (error) throw new Error(error.message);
    }
    return setId;
  },

  async deleteSet(id) {
    const { error } = await supabase.from('dish_sets')
      .update({ deleted_at: new Date().toISOString() }).eq('id', id);
    if (error) throw new Error(error.message);
  },

  async hideLibrarySet(kitchenId, libraryKey) {
    // Строка-заглушка с deleted_at: набор больше не предлагается из справочника
    const { error } = await supabase.from('dish_sets').insert({
      kitchen_id: kitchenId, name: libraryKey, library_key: libraryKey,
      deleted_at: new Date().toISOString(), created_by: cachedUserId,
    });
    if (error) throw new Error(error.message);
  },

  async applySet(setId) {
    const { error } = await supabase.rpc('apply_dish_set', { p_set: setId });
    if (error) throw new Error(error.message);
  },

  async removePlannedSet(plannedSetId) {
    const { error } = await supabase.rpc('remove_planned_set', { p_planned_set: plannedSetId });
    if (error) throw new Error(error.message);
  },

  async clearPlan(kitchenId) {
    const { error } = await supabase.rpc('clear_plan', { p_kitchen: kitchenId });
    if (error) throw new Error(error.message);
  },

  async planNeeds(kitchenId) {
    return unwrap(await supabase.rpc('plan_needs', { p_kitchen: kitchenId })) as PlanNeedRow[];
  },
};
