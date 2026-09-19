import { useState } from 'react';
import { Button, Toggle, useToast } from '@/shared/ui';
import { useSetInStock } from '@/shared/hooks/useProducts';
import { t } from '@/shared/lib/i18n';
import type { Product } from '@/shared/db/types';

interface Props {
  kitchenId: string;
  products: Product[];
  onDone: () => void;
}

/**
 * «Что из этого уже есть дома?» (backlog п. 8).
 *
 * Карусель отвечает на вопрос «что я обычно покупаю» или «что хочу готовить»,
 * а не «что у меня есть сейчас». Раньше продукты из карусели записывались как
 * имеющиеся — это был вымысел. Теперь состояние задаёт человек: всё приходит
 * как «нет», здесь отмечается то, что есть. Плоский список, ползунок на строку —
 * это быстрее, чем проходить карусель второй раз.
 */
export function StockCheck({ kitchenId, products, onDone }: Props) {
  const toast = useToast();
  const setInStock = useSetInStock(kitchenId);
  const [have, setHave] = useState<Set<string>>(new Set());

  const sorted = [...products].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const toggle = (id: string, next: boolean) =>
    setHave((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(id);
      else copy.delete(id);
      return copy;
    });

  const finish = () => {
    if (have.size === 0) {
      onDone();
      return;
    }
    setInStock.mutate(
      { ids: [...have], inStock: true },
      {
        onSuccess: onDone,
        onError: (e) =>
          toast.show(t('products.saveFailed', { reason: e instanceof Error ? e.message : '' })),
      },
    );
  };

  return (
    <div className="mx-auto flex min-h-[100dvh] w-full max-w-[420px] flex-col px-3 pt-6">
      <h1 className="px-1 text-title">{t('stock.title')}</h1>
      <p className="mt-1 px-1 text-caption text-text-muted">{t('stock.hint')}</p>

      <div className="mt-5 flex-1 pb-32">
        {sorted.map((product) => (
          <div
            key={product.id}
            role="button"
            tabIndex={0}
            onClick={() => toggle(product.id, !have.has(product.id))}
            onKeyDown={(e) => {
              if (e.target !== e.currentTarget) return;
              if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(product.id, !have.has(product.id)); }
            }}
            className="mb-0.5 flex h-12 cursor-pointer select-none items-center justify-between rounded-md bg-surface px-3"
          >
            <span className={have.has(product.id) ? 'text-body text-text-primary' : 'text-body text-[#8A8A8A]'}>
              {product.name}
            </span>
            <span onClick={(e) => e.stopPropagation()}>
              <Toggle
                checked={have.has(product.id)}
                onChange={(next) => toggle(product.id, next)}
                label={`${product.name} — есть дома`}
              />
            </span>
          </div>
        ))}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-bg via-bg to-transparent px-3 pt-8"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
      >
        <Button onClick={finish} loading={setInStock.isPending}>
          {have.size > 0 ? t('stock.doneWith', { count: have.size }) : t('stock.done')}
        </Button>
      </div>
    </div>
  );
}
