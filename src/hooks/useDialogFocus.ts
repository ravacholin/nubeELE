import { useEffect, useRef } from 'react';

const dialogs: HTMLElement[] = [];
let previousOverflow = '';
const focusable = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';

/** Keep keyboard navigation and page scrolling inside the active dialog. */
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    if (!dialogs.length) {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
    }
    dialogs.push(dialog);
    dialog.focus({ preventScroll: true });
    const onKey = (event: KeyboardEvent) => {
      if (dialogs.at(-1) !== dialog || event.key !== 'Tab') return;
      const items = [...dialog.querySelectorAll<HTMLElement>(focusable)].filter(item => {
        const closed = item.closest('details:not([open])');
        return item.getClientRects().length > 0 && (!closed || closed.querySelector(':scope > summary')?.contains(item));
      });
      const index = items.indexOf(document.activeElement as HTMLElement);
      if (!items.length) { event.preventDefault(); dialog.focus(); }
      else if (event.shiftKey && index <= 0) { event.preventDefault(); items.at(-1)!.focus(); }
      else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      const index = dialogs.indexOf(dialog);
      if (index >= 0) dialogs.splice(index, 1);
      if (!dialogs.length) document.body.style.overflow = previousOverflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open]);
  return ref;
}
