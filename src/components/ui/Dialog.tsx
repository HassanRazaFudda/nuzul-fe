import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Wide fits a table, such as a before-and-after preview. */
  size?: 'md' | 'lg';
}

/**
 * A modal on the native <dialog>: focus trap, Esc, the top layer and returning focus come
 * from the browser. The effect is legitimate: it synchronises React state with that API.
 */
export function Dialog({ open, onClose, title, children, footer, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // The browser focuses the first focusable element, which is the close button: one
      // space while typing would close the form. Start on the first field instead; with
      // no field, on the first footer button, which is the safe choice (Cancel).
      dialog
        .querySelector<HTMLElement>('form input:not([readonly]), form select, form textarea, footer button')
        ?.focus();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      // Esc asks the parent, which may refuse: a form with unsaved work asks first.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      // Only a close the browser forced itself; our own closes come from `open`.
      onClose={() => {
        if (open) onClose();
      }}
      aria-labelledby={titleId}
      className={cn(
        'rounded-card border-border bg-surface text-foreground shadow-overlay m-auto w-[calc(100%-2rem)] border p-0',
        size === 'lg' ? 'max-w-3xl' : 'max-w-xl',
      )}
    >
      <header className="border-border flex items-center justify-between gap-3 border-b px-5 py-3.5">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-control text-muted hover:bg-background hover:text-foreground p-1"
        >
          <X aria-hidden className="size-4" />
        </button>
      </header>
      <div className="text-muted max-h-[70vh] overflow-y-auto px-5 py-4 text-sm">{children}</div>
      {footer && (
        <footer className="border-border flex flex-wrap justify-end gap-2 border-t px-5 py-3">
          {footer}
        </footer>
      )}
    </dialog>
  );
}
