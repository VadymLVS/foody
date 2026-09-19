import type { Category, DeckCard, Dish, PlanNeedRow, Product, Unit } from '@/shared/db/types';

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
  ingredients: NewIngredient[];
}

/** Блюдо вместе с посчитанной готовностью — то, что нужно всем экранам. */
export interface DishWithStatus extends Dish {
  missingCount: number;
  missingNames: string[];
  isFavorite: boolean;
  isPlanned: boolean;
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
  /** Сколько ингредиентов в блюдах ссылаются на продукт с указанным количеством. */
  countQuantifiedUsage(productId: string): Promise<number>;
  softDeleteProduct(id: string): Promise<void>;
  restoreProduct(id: string): Promise<void>;
  subscribeProducts(kitchenId: string, onChange: (e: RealtimeEvent) => void): () => void;

  listDishes(kitchenId: string): Promise<DishWithStatus[]>;
  createDish(kitchenId: string, input: NewDish): Promise<string>;
  deleteDish(id: string): Promise<void>;
  toggleFavorite(dishId: string, next: boolean): Promise<void>;

  loadDeck(kitchenId: string): Promise<DeckCard[]>;

  /** Что готовим — без даты и слотов (D-028). */
  listPlanned(kitchenId: string): Promise<string[]>;
  addToPlan(kitchenId: string, dishId: string): Promise<void>;
  removeFromPlan(kitchenId: string, dishId: string): Promise<void>;

  /** Потребности по плану, сложенные по всем участникам (D-031). */
  planNeeds(kitchenId: string): Promise<PlanNeedRow[]>;
}
