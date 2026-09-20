import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronLeft } from 'lucide-react';
import { Button, useToast } from '@/shared/ui';
import { useDiet, useSaveDiet } from '@/shared/hooks/useDiet';
import {
  ALLERGY_GROUPS, DIETS, DISLIKE_GROUPS, forbiddenGroups,
  type Diet, type DietGroup,
} from '@/shared/lib/diet';
import { cn } from '@/shared/lib/cn';
import { t } from '@/shared/lib/i18n';

/**
 * «Что вы едите?» (п. 36, D-060). Один раз после первой кухни и в Настройках.
 *
 * Тип питания + теги «Не ем» и «Аллергии». Теги, которые тип и так исключает,
 * не показываются: вегетарианцу незачем отмечать «не ем свинину».
 */
export function DietScreen({ mode }: { mode: 'onboarding' | 'settings' }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: current } = useDiet();
  const save = useSaveDiet();

  const [diet, setDiet] = useState<Diet>('omnivore');
  const [excludes, setExcludes] = useState<DietGroup[]>([]);

  useEffect(() => {
    if (!current) return;
    setDiet(current.diet ?? 'omnivore');
    setExcludes(current.excludes);
  }, [current]);

  const implied = forbiddenGroups({ diet, excludes: [] });
  const toggle = (g: DietGroup) =>
    setExcludes((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const finish = (profile: { diet: Diet; excludes: DietGroup[] }) => {
    // Теги, поглощённые типом питания, не храним — иначе смена типа их «воскрешала» бы
    const clean = { diet: profile.diet, excludes: profile.excludes.filter((g) => !forbiddenGroups({ diet: profile.diet, excludes: [] }).has(g)) };
    save.mutate(clean, {
      onSuccess: () => {
        if (mode === 'settings') {
          toast.show(t('diet.saved'));
          navigate('/settings');
        }
      },
      onError: (e) => toast.show(t('products.saveFailed', { reason: e instanceof Error ? e.message : '' })),
    });
  };

  const chips = (title: string, groups: DietGroup[]) => {
    const visible = groups.filter((g) => !implied.has(g));
    if (visible.length === 0) return null;
    return (
      <section className="mt-6">
        <h2 className="mb-2 text-micro text-text-muted">{title}</h2>
        <div className="flex flex-wrap gap-2">
          {visible.map((g) => {
            const on = excludes.includes(g);
            return (
              <button
                key={g}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(g)}
                className={cn(
                  'flex h-10 items-center gap-1.5 rounded-full border px-4 text-caption transition-colors',
                  on ? 'border-accent bg-accent/10 text-accent' : 'border-line text-text-muted',
                )}
              >
                {on && <Check className="h-3.5 w-3.5" />}
                {t(`diet.group.${g}` as 'diet.group.pork')}
              </button>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <div className="mx-auto min-h-[100dvh] max-w-[420px] px-4 pb-10 pt-4">
      {mode === 'settings' && (
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label={t('common.back')}
          className="-ml-2 flex h-11 w-11 items-center justify-center text-text-muted"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      )}

      <h1 className={cn('text-title', mode === 'onboarding' && 'mt-8')}>{t('diet.title')}</h1>
      <p className="mt-2 text-body text-text-muted">{t('diet.hint')}</p>

      <div className="mt-6 flex flex-col gap-1.5" role="radiogroup" aria-label={t('diet.title')}>
        {DIETS.map((d) => (
          <button
            key={d}
            type="button"
            role="radio"
            aria-checked={diet === d}
            onClick={() => setDiet(d)}
            className={cn(
              'flex min-h-14 items-center justify-between rounded-md border-[0.5px] bg-surface px-4 py-3 text-left',
              diet === d ? 'border-accent/70' : 'border-transparent',
            )}
          >
            <span>
              <span className={cn('block text-body', diet === d && 'text-accent')}>{t(`diet.${d}` as 'diet.omnivore')}</span>
              <span className="block text-caption text-text-dim">{t(`diet.${d}.hint` as 'diet.omnivore.hint')}</span>
            </span>
            {diet === d && <Check className="h-5 w-5 shrink-0 text-accent" />}
          </button>
        ))}
      </div>

      {chips(t('diet.dislikes'), DISLIKE_GROUPS)}
      {chips(t('diet.allergies'), ALLERGY_GROUPS)}

      <div className="mt-8 flex flex-col gap-2">
        <Button fullWidth size="lg" loading={save.isPending} onClick={() => finish({ diet, excludes })}>
          {t('diet.done')}
        </Button>
        {mode === 'onboarding' && (
          <Button variant="ghost" fullWidth onClick={() => finish({ diet: 'omnivore', excludes: [] })}>
            {t('diet.skip')}
          </Button>
        )}
      </div>
    </div>
  );
}
