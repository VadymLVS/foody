import type { ReactNode } from 'react';

interface Props {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Пустой экран — это приглашение действовать, а не сообщение об отсутствии данных. */
export function EmptyState({ icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center px-8 py-16 text-center">
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      <h2 className="text-headline">{title}</h2>
      {description && <p className="mt-2 text-caption text-text-muted">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
