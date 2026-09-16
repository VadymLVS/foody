/** Ключи кэша TanStack Query. Одно место, чтобы инвалидация не разъезжалась. */
export const qk = {
  session:    ['session'] as const,
  kitchens:   ['kitchens'] as const,
  members:    (k: string) => ['members', k] as const,
  categories: (k: string) => ['categories', k] as const,
  products:   (k: string) => ['products', k] as const,
  dishes:     (k: string) => ['dishes', k] as const,
  deck:       (k: string) => ['deck', k] as const,
  planned:    (k: string) => ['planned', k] as const,
  planNeeds:  (k: string) => ['plan-needs', k] as const,
  suggestions:['suggestions'] as const,
};
