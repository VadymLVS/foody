import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ChevronRight, Plus, Users } from 'lucide-react';
import { Button, Input, Modal, Toggle, useToast } from '@/shared/ui';
import { auth } from '@/shared/api';
import { useSession } from '@/shared/hooks/useSession';
import { useCurrentKitchen, useKitchenActions, useKitchens } from '@/shared/hooks/useKitchens';
import { useUI } from '@/shared/store/ui';
import { t } from '@/shared/lib/i18n';
import { cn } from '@/shared/lib/cn';

export function SettingsScreen() {
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useSession();
  const { data: list = [] } = useKitchens();
  const current = useCurrentKitchen();
  const setKitchen = useUI((s) => s.setKitchen);
  const showImages = useUI((s) => s.showRowImages);
  const playful = useUI((s) => s.playfulReactions);
  const setPreferences = useUI((s) => s.setPreferences);
  const { create } = useKitchenActions();

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <div className="mx-auto max-w-[520px] px-4 pb-8 pt-4">
      <h1 className="mb-6 text-title">Настройки</h1>

      <Block title="Текущая кухня">
        <Row onClick={() => current && navigate(`/kitchens/${current.id}`)}>
          <div className="min-w-0">
            <p className="truncate text-body-semibold">{current?.name ?? 'Не выбрана'}</p>
            {current && (
              <p className="mt-0.5 flex items-center gap-1 text-small text-text-muted">
                <Users className="h-3.5 w-3.5" />
                {current.memberCount}{' '}
                {current.role === 'owner' ? '· вы владелец' : '· вы участник'}
              </p>
            )}
          </div>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
        </Row>
      </Block>

      <Block title="Мои кухни">
        {list.map((kitchen) => (
          <Row key={kitchen.id} onClick={() => setKitchen(kitchen.id)}>
            <span className="truncate text-body">{kitchen.name}</span>
            {kitchen.id === current?.id && <Check className="h-5 w-5 shrink-0 text-accent" />}
          </Row>
        ))}
        <Row onClick={() => setCreateOpen(true)}>
          <span className="flex items-center gap-2 text-body text-accent">
            <Plus className="h-5 w-5" />
            Создать новую кухню
          </span>
        </Row>
      </Block>

      <Block title="Отображение">
        <Row>
          <span className="text-body">{t('settings.showImages')}</span>
          <Toggle
            checked={showImages}
            onChange={(v) => setPreferences({ showRowImages: v })}
            label={t('settings.showImages')}
          />
        </Row>
        <Row>
          <span className="text-body">{t('settings.reactions')}</span>
          <Toggle
            checked={playful}
            onChange={(v) => setPreferences({ playfulReactions: v })}
            label={t('settings.reactions')}
          />
        </Row>
      </Block>

      <Block title="Профиль">
        <div className="px-4 py-3">
          <p className="text-headline">{session?.fullName || 'Гость'}</p>
          <p className="mt-0.5 text-caption text-text-muted">{session?.email || 'демо-режим'}</p>
        </div>
        <Row
          onClick={async () => {
            await auth.signOut();
            navigate('/');
          }}
        >
          <span className="text-body">Выйти</span>
        </Row>
      </Block>

      {/* App Store 5.1.1(v): удаление аккаунта обязано быть внутри приложения.
          Держим приглушённым, но не прячем — прятать его нельзя. */}
      <Block title="Аккаунт">
        <Row onClick={() => navigate('/settings/delete-account')}>
          <span className="text-body text-danger">Удалить аккаунт</span>
          <ChevronRight className="h-5 w-5 shrink-0 text-text-muted" />
        </Row>
      </Block>

      <Modal
        open={createOpen}
        title="Новая кухня"
        onClose={() => setCreateOpen(false)}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setCreateOpen(false)}>
              Отмена
            </Button>
            <Button
              fullWidth
              disabled={!newName.trim()}
              loading={create.isPending}
              onClick={() =>
                create.mutate(newName.trim(), {
                  onSuccess: () => {
                    setNewName('');
                    setCreateOpen(false);
                    toast.show('Кухня создана');
                  },
                })
              }
            >
              Создать
            </Button>
          </>
        }
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Например, «Дом» или «Дача»"
          autoFocus
        />
      </Modal>
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="mb-2 px-1 text-small uppercase tracking-wide text-text-muted">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-md bg-surface">
        {children}
      </div>
    </section>
  );
}

function Row({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex min-h-[52px] w-full items-center justify-between gap-3 px-4 py-3 text-left',
        onClick && 'active:bg-surface-2',
      )}
    >
      {children}
    </button>
  );
}
