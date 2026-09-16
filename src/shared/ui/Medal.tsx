/** Иконка из макета: круг #D5FF40 и галочка линией 2px с прямыми концами. */
export function Medal({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden>
      <rect width="40" height="40" rx="20" fill="#D5FF40" />
      <path d="M12.3363 21.4351L19.5595 26.5405L27.8085 14.4348" stroke="black" strokeWidth="2" />
    </svg>
  );
}
