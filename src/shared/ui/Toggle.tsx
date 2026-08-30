import { useRef, useState } from 'react';
import { cn } from '@/shared/lib/cn';

interface Props {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}

/**
 * Ползунок с пружиной (D-024). Дорожка во включённом состоянии не заливается
 * лаймом целиком — светится только кружок, иначе на списке из тридцати позиций
 * акцент размазывается.
 *
 * Растяжение кружка на pointer-событиях, а не на :active: на тач-экранах
 * псевдокласс ведёт себя иначе и иногда залипает после отпускания.
 */
export function Toggle({ checked, onChange, label, disabled }: Props) {
  const [pressed, setPressed] = useState(false);
  const held = useRef(false);

  const release = () => {
    held.current = false;
    setPressed(false);
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onPointerDown={() => {
        held.current = true;
        setPressed(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={() => held.current && release()}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-8 w-14 shrink-0 rounded-full transition-colors duration-200',
        'before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[""]',
        checked ? 'bg-accent-track' : 'bg-[#242424]',
        disabled && 'opacity-50',
      )}
    >
      <span
        className={cn(
          'absolute top-[3px] flex h-[26px] items-center justify-center rounded-full',
          'transition-all duration-300 ease-spring',
          pressed ? 'w-[34px]' : 'w-[26px]',
          checked
            ? pressed ? 'left-[calc(100%-37px)] bg-accent' : 'left-[calc(100%-29px)] bg-accent'
            : 'left-[3px] bg-[#3A3A3A]',
        )}
      >
        {checked && (
          <svg width="15" height="12" viewBox="0 0 17 14" aria-hidden>
            <path
              d="M1.5 7 L6 11.5 L15.5 1.5"
              fill="none"
              stroke="rgb(var(--accent-ink))"
              strokeWidth="2.4"
              strokeLinecap="square"
            />
          </svg>
        )}
      </span>
    </button>
  );
}
