import { useRef, useState } from 'react';
import { Loader2, Receipt } from 'lucide-react';
import { Button, Toggle, useToast } from '@/shared/ui';
import { supabase, hasSupabaseCredentials } from '@/shared/api/supabase';
import { useCategories, useCreateProduct, useProducts, useToggleProduct } from '@/shared/hooks/useProducts';
import { norm } from '@/shared/lib/text';
import { unitLabel } from '@/shared/lib/i18n';
import type { Product, Unit } from '@/shared/db/types';

interface ParsedItem {
  raw: string; name: string; qty: number; unit: Unit; category: string; food: boolean;
}

interface Row extends ParsedItem {
  match: Product | null;   // нашёлся среди продуктов кухни
  apply: boolean;
}

/**
 * Импорт чека (D-036).
 *
 * Ничего не применяется автоматически. Распознавание ошибается, а тихая
 * запись чужих строк в общую кухню хуже, чем лишний экран подтверждения.
 *
 * Непродовольственное приходит выключенным: пакеты и мыло в списке продуктов
 * не нужны, но и решать за человека молча неправильно.
 */
export function ReceiptImport({ kitchenId, onClose }: { kitchenId: string; onClose: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState<Row[] | null>(null);

  const { data: products = [] } = useProducts(kitchenId);
  const { data: categories = [] } = useCategories(kitchenId);
  const toggleProduct = useToggleProduct(kitchenId);
  const createProduct = useCreateProduct(kitchenId);

  /** Сопоставляем с продуктами кухни, а не только со справочником — иначе
   *  «Черри» из чека заведёт второй продукт рядом с уже существующим. */
  const findMatch = (name: string): Product | null => {
    const n = norm(name);
    return products.find((p) => norm(p.name) === n)
      ?? products.find((p) => norm(p.name).includes(n) || n.includes(norm(p.name)))
      ?? null;
  };

  const handleFile = async (file: File) => {
    setBusy(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
        reader.onerror = () => reject(new Error('read_failed'));
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke('parse-receipt', {
        body: { image: base64, mediaType: file.type || 'image/jpeg' },
      });

      if (error || !data?.items) throw new Error('parse_failed');

      setRows((data.items as ParsedItem[]).map((item) => {
        const match = findMatch(item.name);
        return { ...item, match, apply: item.food };
      }));
    } catch {
      toast.show('Не удалось разобрать чек');
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    const selected = rows?.filter((r) => r.apply) ?? [];

    for (const row of selected) {
      if (row.match) {
        toggleProduct(row.match.id, true);
      } else {
        const category = categories.find((c) => c.kind === 'product' && c.key === row.category);
        await createProduct.mutateAsync({
          name: row.name,
          categoryId: category?.id ?? null,
          unit: row.unit,
          inStock: true,
        }).catch(() => undefined);   // дубль по имени — не повод валить весь импорт
      }
    }

    toast.show(`Отмечено: ${selected.length}`);
    setBusy(false);
    onClose();
  };

  if (!hasSupabaseCredentials) {
    return (
      <Sheet onClose={onClose} title="Импорт чека">
        <p className="py-6 text-center text-caption text-text-muted">
          Работает только с подключённой базой
        </p>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Импорт чека">
      {!rows && (
        <div className="py-6 text-center">
          <Receipt className="mx-auto mb-3 h-10 w-10 text-text-dim" />
          <p className="mb-5 text-caption text-text-muted">
            Загрузите фотографию чека — отметим купленное
          </p>
          <input
            ref={input}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <Button onClick={() => input.current?.click()} loading={busy}>
            Выбрать фото
          </Button>
          <p className="mt-4 text-micro text-text-dim">
            Снимок отправляется на разбор и нигде не сохраняется
          </p>
        </div>
      )}

      {rows && (
        <>
          <div className="max-h-[52vh] overflow-y-auto">
            {rows.map((row, i) => (
              <div key={`${row.raw}-${i}`}
                className="flex items-center justify-between gap-3 border-b border-line py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-body">{row.name}</p>
                  <p className="truncate text-micro text-text-dim">
                    {row.raw}
                    {row.qty > 1 && ` · ${row.qty} ${unitLabel(row.unit)}`}
                    {row.match ? ' · есть в списке' : ' · новый продукт'}
                  </p>
                </div>
                <Toggle
                  checked={row.apply}
                  onChange={(next) =>
                    setRows((prev) => prev!.map((r, j) => (j === i ? { ...r, apply: next } : r)))}
                  label={row.name}
                />
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <Button variant="secondary" fullWidth onClick={onClose}>Отмена</Button>
            <Button fullWidth onClick={() => void confirm()} loading={busy}>
              Отметить {rows.filter((r) => r.apply).length}
            </Button>
          </div>
        </>
      )}

      {busy && !rows && (
        <p className="mt-4 flex items-center justify-center gap-2 text-caption text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Разбираем чек…
        </p>
      )}
    </Sheet>
  );
}

function Sheet({
  children, title, onClose,
}: { children: React.ReactNode; title: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-[420px] rounded-t-lg bg-surface p-4 sm:rounded-lg"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        <h2 className="mb-2 text-headline">{title}</h2>
        {children}
      </div>
    </div>
  );
}
