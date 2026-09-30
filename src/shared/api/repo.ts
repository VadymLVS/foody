import type { Category, DeckCard, Dish, PlanNeedRow, Product, Unit } from '@/shared/db/types';
import type { DietProfile } from '@/shared/lib/diet';

export interface NewProduct {
  name: string;
  categoryId: string | null;
  unit: Unit;
  inStock: boolean;
  libraryKey?: string | null;
}

/** Всё, что можно поменять у продукта после создания (п. 11 backlog). */
export type ProductPatch = Partial<
  Pick<Product, 'name' | 'quantity' | 'in_stock' | 'category_id' | 'unit' | 'library_key'>
>;

export interface RealtimeEvent { productId: string; updatedBy: string | null }

/** Ингредиент нового блюда: продукт уже существует в кухне. */
export interface NewIngredient {
  productId: string;
  productName: string;
  quantity: number | null;
}

export interface NewDish {
  name: string;
  categoryId: string | null;
  libraryKey?: string | null;
  /** Текст «Как готовить» (п. 33). */
  recipe?: string | null;
  ingredients: NewIngredient[];
}

/** Блюдо вместе с посчитанной готовностью — то, что нужно всем экранам. */
export interface DishWithStatus extends Dish {
  missingCount: number;
  missingNames: string[];
  isFavorite: boolean;
  isPlanned: boolean;
}

/** Продукт набора без блюда: уголь, вода для пикника (D-053). */
export interface DishSetProduct {
  productId: string;
  productName: string;
  unit: Unit;
  quantity: number | null;
}

/** Набор блюд кухни (D-053). */
export interface DishSet {
  id: string;
  name: string;
  libraryKey: string | null;
  dishIds: string[];
  products: DishSetProduct[];
  /** id применения, если набор сейчас в моём плане. */
  plannedSetId: string | null;
  plannedAt: string | null;
}

export interface DishSetInput {
  name: string;
  libraryKey?: string | null;
  dishIds: string[];
  products: Array<{ productId: string; quantity: number | null }>;
}

export interface SetsListing {
  sets: DishSet[];
  /**
   * Ключи готовых наборов, у которых в кухне уже есть строка — живая или удалённая.
   * Такие наборы не показываются из справочника повторно.
   */
  usedLibraryKeys: string[];
}

/**
 * Список покупок (backlog п. 45, 46). Выбор списка ничего не меняет
 * в продуктах — он сужает выдачу. Но у позиции есть своя заявка:
 * «сколько взять в эту поездку».
 *
 * kind: 'regular' — постоянная заготовка («Обычная закупка»);
 *       'once'    — разовый «купить сейчас», его создают друг для друга,
 *                   он показывается в приоритете и закрывается после поездки.
 */
export interface ProductList {
  id: string;
  name: string;
  kind: 'regular' | 'once';
  items: ProductListItem[];
  createdBy: string | null;
  createdAt: string;
}

/**
 * Позиция списка (п. 46, миграция 0010).
 *
 * `quantity` — заявка этой поездки, а не количество продукта. Два числа
 * отвечают на разные вопросы: `products.quantity` — «сколько лежит дома»,
 * это — «сколько взять». Решение Vadym (10-01): заявка живёт только
 * в списке и количество продукта не трогает, иначе отметка Алины
 * «помидоры 1 кг» переписала бы то, сколько помидоров есть дома.
 *
 * Ноль значит «не указано» — как у `products.quantity` (D-030).
 */
export interface ProductListItem {
  productId: string;
  quantity: number;
}

export interface ProductListInput {
  name: string;
  kind: 'regular' | 'once';
  items: ProductListItem[];
}

export interface Repo {
  readonly isDemo: boolean;
  currentUserId(): string;

  listCategories(kitchenId: string): Promise<Category[]>;
  listProducts(kitchenId: string): Promise<Product[]>;
  listSuggestions(): Promise<Array<{ key: string; name: string; categoryKey: string | null; unit: Unit }>>;

  createProduct(kitchenId: string, input: NewProduct): Promise<Product>;
  /**
   * Пакетная вставка: наполнение кухни из карусели — это десятки позиций сразу.
   * Возвращает созданные продукты: они нужны шагу «что из этого уже есть?».
   * Продукты, которые уже есть в кухне под тем же именем, пропускаются.
   */
  createProducts(kitchenId: string, inputs: NewProduct[]): Promise<Product[]>;
  updateProduct(id: string, patch: ProductPatch): Promise<void>;
  /** Отметить наличие сразу у нескольких продуктов одним запросом. */
  setInStock(ids: string[], inStock: boolean): Promise<void>;
  /**
   * Одна правка сразу многим продуктам — «Выключить всё» и возврат после него
   * (backlog п. 42). Отдельный метод нужен, чтобы 118 продуктов уходили
   * одним запросом, а не сотней.
   */
  bulkPatch(ids: string[], patch: ProductPatch): Promise<void>;

  /** Списки покупок кухни — только открытые; закрытые остаются в базе историей. */
  listProductLists(kitchenId: string): Promise<ProductList[]>;
  saveProductList(kitchenId: string, input: ProductListInput, id?: string): Promise<string>;
  /**
   * Заявка у позиции уже сохранённого списка: её правят прямо в магазине,
   * не открывая форму. Ноль — «не указано» (п. 46).
   */
  setListItemQuantity(listId: string, productId: string, quantity: number): Promise<void>;
  deleteProductList(id: string): Promise<void>;
  /** Поездка закончена: список уходит из выдачи, но остаётся в истории. */
  closeProductList(id: string): Promise<void>;
  /** Разовый список создаёт один человек, а видит другой — без перезапуска. */
  subscribeProductLists(kitchenId: string, onChange: () => void): () => void;
  /** Сколько ингредиентов в блюдах ссылаются на продукт с указанным количеством. */
  countQuantifiedUsage(productId: string): Promise<number>;
  softDeleteProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
  subscribeProducts(kitchenId: string, onChange: (e: RealtimeEvent) => void): () => void;

  listDishes(kitchenId: string): Promise<DishWithStatus[]>;
  createDish(kitchenId: string, input: NewDish): Promise<string>;
  /** Правка блюда: название, категория, рецепт; состав заменяется целиком (п. 32). */
  updateDish(id: string, input: NewDish): Promise<void>;
  deleteDish(id: string): Promise<void>;
  /** Вернуть удалённое блюдо — «Отменить» в тосте, как у продуктов (D-009, U-1). */
  restoreDish(id: string): Promise<void>;
  toggleFavorite(dishId: string, next: boolean): Promise<void>;

  loadDeck(kitchenId: string): Promise<DeckCard[]>;

  /** Что готовим — без даты и слотов (D-028). */
  listPlanned(kitchenId: string): Promise<string[]>;
  addToPlan(kitchenId: string, dishId: string): Promise<void>;
  removeFromPlan(kitchenId: string, dishId: string): Promise<void>;

  /** Наборы блюд (D-053…D-056). */
  listSets(kitchenId: string): Promise<SetsListing>;
  /** Создать набор или, если передан id, заменить его содержимое. */
  saveSet(kitchenId: string, input: DishSetInput, id?: string): Promise<string>;
  deleteSet(id: string): Promise<void>;
  /** Скрыть готовый набор, который ещё не заводился в кухне. */
  hideLibrarySet(kitchenId: string, libraryKey: string): Promise<void>;
  /** Блюда набора — к плану, продукты без блюда — в «Купить» с прибавкой количества. */
  applySet(setId: string): Promise<void>;
  /** Снять набор: вернуть план и продукты как были, кроме уже купленного. */
  removePlannedSet(plannedSetId: string): Promise<void>;
  /** Снять все свои наборы и блюда. */
  clearPlan(kitchenId: string): Promise<void>;

  /** Питание текущего человека (п. 36). */
  getDiet(): Promise<DietProfile>;
  saveDiet(profile: DietProfile): Promise<void>;

  /** Потребности по плану, сложенные по всем участникам (D-031). */
  planNeeds(kitchenId: string): Promise<PlanNeedRow[]>;
}
