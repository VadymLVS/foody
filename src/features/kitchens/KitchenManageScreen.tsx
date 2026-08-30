import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Copy, Crown, RefreshCw, Share2 } from 'lucide-react';
import { Button, Input, Modal, useToast } from '@/shared/ui';
import { formatExpiry, inviteUrl } from '@/shared/api';
import { useCurrentKitchen, useKitchenActions, useMembers } from '@/shared/hooks/useKitchens';
import { useSession } from '@/shared/hooks/useSession';

export function KitchenManageScreen() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { session } = useSession();
  const kitchen = useCurrentKitchen();
  const { data: members = [] } = useMembers(id);
  const { rename, remove, leave, regenerateInvite, removeMember } = useKitchenActions();

  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState(kitchen?.name ?? '');
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');

  const isOwner = kitchen?.role === 'owner';
  const link = kitchen?.inviteCode ? inviteUrl(kitchen.inviteCode) : null;

  const copyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.show('Ссылка скопирована');
    } catch {
      toast.show('Не удалось скопировать', { tone: 'danger' });
    }
  };

  const shareLink = async () => {
    if (!link) return;
    // Системный шеринг — то, чем люди реально пользуются на телефоне.
    if (navigator.share) {
      try {
        await navigator.share({ title: 'PantrySync', text: 'Присоединяйся к кухне', url: link });
        return;
      } catch {
        /* пользователь отменил */
      }
    }
    void copyLink();
  };

  if (!kitchen) return <p className="p-12 text-center text-caption text-text-muted">Загружаем…</p>;

  return (
    <div className="mx-auto max-w-[520px] px-4 pb-8 pt-4">
      <button type="button" onClick={() => navigate(-1)} className="text-caption text-accent">
        Назад
      </button>

      <div className="mt-4 flex items-center justify-between gap-3">
        <h1 className="truncate text-title">{kitchen.name}</h1>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setName(kitchen.name);
            setRenameOpen(true);
          }}
        >
          Переименовать
        </Button>
      </div>

      {isOwner && link && (
        <section className="mt-6">
          <h2 className="mb-2 px-1 text-small uppercase tracking-wide text-text-muted">
            Приглашение
          </h2>
          <div className="rounded-md bg-surface p-4 shadow-card">
            <p className="truncate text-caption text-text-muted">{link}</p>
            <p className="mt-1 text-small text-text-muted">
              {formatExpiry(kitchen.inviteExpiresAt)}
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="secondary" onClick={shareLink}>
                <Share2 className="h-4 w-4" />
                Поделиться
              </Button>
              <Button size="sm" variant="secondary" onClick={copyLink}>
                <Copy className="h-4 w-4" />
                Копировать
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={regenerateInvite.isPending}
                onClick={() =>
                  regenerateInvite.mutate(kitchen.id, {
                    onSuccess: () => toast.show('Старая ссылка больше не работает'),
                  })
                }
              >
                <RefreshCw className="h-4 w-4" />
                Обновить
              </Button>
            </div>
            <p className="mt-3 text-small text-text-muted">
              Ссылка даёт полный доступ к кухне. Обновите её, если она попала не туда.
            </p>
          </div>
        </section>
      )}

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-small uppercase tracking-wide text-text-muted">
          Участники · {members.length}
        </h2>
        <div className="divide-y divide-line overflow-hidden rounded-md bg-surface">
          {members.map((member) => (
            <div key={member.user_id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-body-semibold">
                  {member.profile?.full_name ?? member.profile?.email ?? 'Участник'}
                  {member.role === 'owner' && <Crown className="h-4 w-4 shrink-0 text-warning" />}
                </p>
                <p className="truncate text-small text-text-muted">{member.profile?.email}</p>
              </div>
              {isOwner && member.user_id !== session?.userId && (
                <button
                  type="button"
                  onClick={() => removeMember.mutate({ id: kitchen.id, userId: member.user_id })}
                  className="shrink-0 text-caption text-danger"
                >
                  Удалить
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-2 px-1 text-small uppercase tracking-wide text-text-muted">
          Опасная зона
        </h2>
        {isOwner ? (
          <Button variant="danger" fullWidth onClick={() => setDeleteOpen(true)}>
            Удалить кухню
          </Button>
        ) : (
          <Button
            variant="secondary"
            fullWidth
            loading={leave.isPending}
            onClick={() => leave.mutate(kitchen.id, { onSuccess: () => navigate('/settings') })}
          >
            Покинуть кухню
          </Button>
        )}
      </section>

      <Modal
        open={renameOpen}
        title="Переименовать кухню"
        onClose={() => setRenameOpen(false)}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setRenameOpen(false)}>
              Отмена
            </Button>
            <Button
              fullWidth
              disabled={!name.trim() || name === kitchen.name}
              onClick={() =>
                rename.mutate(
                  { id: kitchen.id, name: name.trim() },
                  { onSuccess: () => setRenameOpen(false) },
                )
              }
            >
              Сохранить
            </Button>
          </>
        }
      >
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Modal>

      {/* Удаление кухни необратимо и задевает других людей —
          здесь подтверждение вводом названия оправдано (в отличие от продуктов, D-009). */}
      <Modal
        open={deleteOpen}
        title="Удалить кухню?"
        onClose={() => setDeleteOpen(false)}
        footer={
          <>
            <Button variant="secondary" fullWidth onClick={() => setDeleteOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="danger"
              fullWidth
              disabled={deleteConfirm.trim() !== kitchen.name}
              loading={remove.isPending}
              onClick={() =>
                remove.mutate(kitchen.id, { onSuccess: () => navigate('/settings') })
              }
            >
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-caption text-text-muted">
          Продукты, блюда и планы будут удалены у всех участников. Введите название
          кухни, чтобы подтвердить.
        </p>
        <Input
          value={deleteConfirm}
          onChange={(e) => setDeleteConfirm(e.target.value)}
          placeholder={kitchen.name}
        />
      </Modal>
    </div>
  );
}
