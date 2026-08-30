import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/shared/lib/cn';

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, Props>(function Input(
  { iconLeft, iconRight, error, className, ...rest },
  ref,
) {
  return (
    <div className="w-full">
      <div
        className={cn(
          'flex h-12 items-center gap-2 rounded-sm bg-surface-2 px-3',
          'border transition-colors duration-150',
          error ? 'border-danger' : 'border-line focus-within:border-accent',
        )}
      >
        {iconLeft && <span className="shrink-0 text-text-muted">{iconLeft}</span>}
        <input
          ref={ref}
          className={cn(
            'min-w-0 flex-1 bg-transparent text-body outline-none',
            'placeholder:text-text-muted',
            className,
          )}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        {iconRight && <span className="shrink-0">{iconRight}</span>}
      </div>
      {error && <p className="mt-1 px-1 text-caption text-danger">{error}</p>}
    </div>
  );
});
