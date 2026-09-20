/**
 * Питание человека (backlog п. 36, D-060).
 *
 * У каждого своё: в одной кухне один ест мясо, другой нет. Действует только
 * на подсказки — карусели быстрого старта и готовые наборы. Блюда и продукты
 * кухни не прячутся: кухня общая.
 */
export type Diet = 'omnivore' | 'pescatarian' | 'vegetarian' | 'vegan';

/** Группы продуктов, по которым решается «подходит или нет». */
export type DietGroup =
  | 'pork' | 'beef' | 'poultry' | 'fish' | 'seafood' | 'mushrooms'
  | 'dairy' | 'gluten' | 'nuts' | 'eggs' | 'honey';

export interface DietProfile {
  /** null — человек ещё не отвечал: экран «Что вы едите?» покажется один раз. */
  diet: Diet | null;
  /** «Не ем» и «Аллергии» — одним списком групп. */
  excludes: DietGroup[];
}

export const DIETS: Diet[] = ['omnivore', 'pescatarian', 'vegetarian', 'vegan'];
/** Теги «Не ем». */
export const DISLIKE_GROUPS: DietGroup[] = ['pork', 'beef', 'poultry', 'fish', 'seafood', 'mushrooms'];
/** Теги «Аллергии и непереносимость». */
export const ALLERGY_GROUPS: DietGroup[] = ['dairy', 'gluten', 'nuts', 'eggs'];

/** Что исключает сам тип питания — теги поверх него только добавляют запреты. */
const DIET_RULES: Record<Diet, DietGroup[]> = {
  omnivore: [],
  pescatarian: ['pork', 'beef', 'poultry'],
  vegetarian: ['pork', 'beef', 'poultry', 'fish', 'seafood'],
  vegan: ['pork', 'beef', 'poultry', 'fish', 'seafood', 'dairy', 'eggs', 'honey'],
};

/**
 * Группы продуктов справочника. Ключи — те же, что у продуктов (0005_seed.sql,
 * dishLibrary.ts). Продукт без записи ни в какую группу не входит.
 * Спорное решено в сторону осторожности: фарш и пельмени — свинина и говядина,
 * овсянка — глютен (обычно перерабатывается вместе с пшеницей).
 */
export const PRODUCT_GROUPS: Record<string, DietGroup[]> = {
  pork: ['pork'], bacon: ['pork'], ham: ['pork'], sausages: ['pork'],
  mince: ['pork', 'beef'], beef: ['beef'],
  chicken: ['poultry'], turkey: ['poultry'],
  fish: ['fish'], salmon: ['fish'], herring: ['fish'], tuna_canned: ['fish'],
  shrimp: ['seafood'],
  mushrooms: ['mushrooms'],
  milk: ['dairy'], kefir: ['dairy'], sour_cream: ['dairy'], cottage_cheese: ['dairy'],
  cheese: ['dairy'], butter: ['dairy'], yogurt: ['dairy'], ryazhenka: ['dairy'],
  cream: ['dairy'], mozzarella: ['dairy'], feta: ['dairy'], ice_cream: ['dairy', 'eggs'],
  chocolate: ['dairy'],
  bread: ['gluten'], loaf: ['gluten'], pasta: ['gluten'], flour: ['gluten'],
  lavash: ['gluten'], buns: ['gluten'], crispbread: ['gluten'], couscous: ['gluten'],
  bulgur: ['gluten'], oats: ['gluten'], cookies: ['gluten', 'dairy'], waffles: ['gluten', 'eggs'],
  beer: ['gluten'], soy_sauce: ['gluten'],
  dumplings: ['gluten', 'pork', 'beef'], pizza_frozen: ['gluten', 'dairy'],
  nuts: ['nuts'], peanut_butter: ['nuts'],
  eggs: ['eggs'], mayonnaise: ['eggs'],
  honey: ['honey'],
};

export function forbiddenGroups(profile: DietProfile | null | undefined): Set<DietGroup> {
  if (!profile?.diet) return new Set(profile?.excludes ?? []);
  return new Set([...DIET_RULES[profile.diet], ...profile.excludes]);
}

/** Подходит ли продукт справочника. Продукты не из справочника (key = null) — всегда. */
export function productAllowed(key: string | null, forbidden: Set<DietGroup>): boolean {
  if (!key || forbidden.size === 0) return true;
  return !(PRODUCT_GROUPS[key] ?? []).some((g) => forbidden.has(g));
}

/** Блюдо подходит, если подходит каждый ингредиент. */
export function dishAllowed(ingredientKeys: string[], forbidden: Set<DietGroup>): boolean {
  return ingredientKeys.every((k) => productAllowed(k, forbidden));
}
