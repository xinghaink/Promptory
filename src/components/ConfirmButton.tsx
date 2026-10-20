import { useEffect, useState, type ReactNode } from 'react';

interface Props {
  className?: string;
  label: ReactNode;
  confirmLabel: ReactNode;
  ariaLabel?: string;
  onConfirm: () => void | Promise<void>;
}

/** Destructive action in two clicks; the second click must come within 4 seconds. */
export function ConfirmButton({ className, label, confirmLabel, ariaLabel, onConfirm }: Props) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      className={className}
      aria-label={ariaLabel}
      onClick={() => {
        if (armed) {
          setArmed(false);
          void onConfirm();
        } else setArmed(true);
      }}
    >
      {armed ? confirmLabel : label}
    </button>
  );
}
