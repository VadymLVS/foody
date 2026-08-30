/** Временные типы. После первого `db push` заменяются на `npm run db:types`. */

export type Unit = 'pcs' | 'kg' | 'g' | 'l' | 'ml' | 'pack';
export type Role = 'owner' | 'member';
export type CategoryKind = 'product' | 'dish';

export interface Profile {
  id: string; email: string; full_name: string | null; avatar_url: string | null;
}

export interface Kitchen {
  id: string; name: string; owner_id: string;
  invite_code: string; invite_expires_at: string | null; invites_enabled: boolean;
}

export interface Member {
  kitchen_id: string; user_id: string; role: Role; joined_at: string; profile?: Profile;
}

export interface Category {
  id: string; kitchen_id: string | null; kind: CategoryKind;
  key: string | null; name: string | null; sort_order: number;
}

export interface Product {
  id: string; kitchen_id: string; name: string; category_id: string | null;
  unit: Unit; quantity: number; in_stock: boolean;
  library_key: string | null;
  deleted_at: string | null; updated_by: string | null; updated_at: string;
}

export interface DishIngredient {
  id: string; dish_id: string;
  product_id: string | null; product_name: string;
  quantity: number | null;   // единица берётся у продукта (D-030)
}

export interface Dish {
  id: string; kitchen_id: string; name: string; category_id: string | null;
  image_path: string | null; library_key: string | null;
  image_w: number | null; image_h: number | null;
  deleted_at: string | null;
  ingredients?: DishIngredient[];
}

/** Строка из RPC swipe_deck. */
export interface DeckCard {
  dish_id: string; name: string;
  image_path: string | null; library_key: string | null;
  image_w: number | null; image_h: number | null;
  missing_count: number; missing_names: string[];
  is_favorite: boolean;
}

/** Строка из RPC plan_needs — что и сколько нужно купить под план. */
export interface PlanNeedRow {
  product_id: string; product_name: string; unit: Unit;
  total_quantity: number | null; dish_count: number;
  dishes: Array<{ dish: string; quantity: number | null; owner: string | null }>;
}

export interface UserSettings {
  user_id: string;
  language: 'ru' | 'uk' | 'en' | 'es';
  show_row_images: boolean;
  playful_reactions: boolean;
}

export type Database = Record<string, unknown>;
