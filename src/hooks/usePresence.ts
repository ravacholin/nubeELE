import { useEffect, useState } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Keep the last non-null value mounted for `exitMs` after it disappears,
 * so surfaces can play an exit transition before unmounting.
 */
export function usePresence<T>(value: T | null | undefined, exitMs = 220) {
  const [rendered, setRendered] = useState<T | null>(value ?? null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (value) {
      setRendered(value);
      setClosing(false);
      return;
    }
    if (!rendered) return;
    if (prefersReducedMotion()) {
      setRendered(null);
      return;
    }
    setClosing(true);
    const timer = setTimeout(() => {
      setRendered(null);
      setClosing(false);
    }, exitMs);
    return () => clearTimeout(timer);
  }, [value, exitMs]);

  return { rendered: value ?? rendered, closing: !value && closing };
}
