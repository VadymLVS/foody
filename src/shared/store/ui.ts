import { create } from 'zustand';

type StatusFilter = 'all' | 'to-buy' | 'plan' | 'in-stock';

interface PendingOp { field: string; value: unknown; ts: number }

interface UIState {
  currentKitchenId: string | null;
  search: string;
  categoryFilter: string;
  statusFilter: StatusFilter;
  /**
   * Выбранный список покупок (п. 45). Это отдельное измерение от statusFilter:
   * внутри списка показываются и купленные, и некупленные позиции, поэтому
   * фильтры состояния при активном списке не применяются.
   */
  listFilter: string | null;
  activeProductId: string | null;

  // Из user_settings; до загрузки — разумные значения по умолчанию
  showRowImages: boolean;
  playfulReactions: boolean;

  /** D-010: операции в полёте — чтобы не реагировать на собственное эхо realtime */
  pendingOps: Map<string, PendingOp>;

  setKitchen: (id: string | null) => void;
  setSearch: (q: string) => void;
  setCategoryFilter: (id: string) => void;
  setStatusFilter: (f: StatusFilter) => void;
  setListFilter: (id: string | null) => void;
  setActiveProduct: (id: string | null) => void;
  setPreferences: (p: { showRowImages?: boolean; playfulReactions?: boolean }) => void;
  beginOp: (id: string, op: Omit<PendingOp, 'ts'>) => void;
  endOp: (id: string) => void;
  isEcho: (id: string, updatedBy: string | null, selfId: string) => boolean;
}

const ECHO_WINDOW_MS = 5000;

export const useUI = create<UIState>((set, get) => ({
  currentKitchenId: null,
  search: '',
  categoryFilter: 'all',
  // По умолчанию весь список (решение Vadym, backlog п. 14). Раньше был «Купить»
  // с расчётом, что приложение открывают перед магазином.
  statusFilter: 'all',
  listFilter: null,
  activeProductId: null,
  showRowImages: true,
  playfulReactions: true,
  pendingOps: new Map(),

  setKitchen: (id) => set({ currentKitchenId: id, activeProductId: null, search: '', listFilter: null }),
  setSearch: (search) => set({ search }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter }),
  setStatusFilter: (statusFilter) => set({ statusFilter, listFilter: null }),
  // Выбор списка сбрасывает поиск: список короткий, искать в нём нечего,
  // а незамеченная строка поиска выглядела бы как пустой список
  setListFilter: (listFilter) => set({ listFilter, search: '' }),
  setActiveProduct: (activeProductId) => set({ activeProductId }),
  setPreferences: (p) => set(p),

  beginOp: (id, op) => {
    const next = new Map(get().pendingOps);
    next.set(id, { ...op, ts: Date.now() });
    set({ pendingOps: next });
  },
  endOp: (id) => {
    const next = new Map(get().pendingOps);
    next.delete(id);
    set({ pendingOps: next });
  },
  isEcho: (id, updatedBy, selfId) => {
    const pending = get().pendingOps.get(id);
    if (!pending) return false;
    return updatedBy === selfId && Date.now() - pending.ts < ECHO_WINDOW_MS;
  },
}));
