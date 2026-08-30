import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

/** Белая пилюля — главное действие экрана. Лайм зарезервирован под состояния. */
const variants: Record<Variant, string> = {
  primary:   'bg-white text-black active:bg-[#E0E0E0]',
  secondary: 'border border-[#242424] text-[#8A8A8A] active:bg-surface',
  danger:    'bg-danger text-white active:brightness-90',
  ghost:     'text-accent active:bg-accent/10',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-micro',
  md: 'h-10 px-5 text-body',
  lg: 'h-12 px-6 text-body',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  { variant = 'primary', size = 'md', loading, fullWidth, className, children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-full transition-colors duration-150',
        'select-none disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant], sizes[size], fullWidth && 'w-full', className,
      )}
      {...rest}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : children}
    </button>
  );
});
