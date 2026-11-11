import { useId, type ReactElement, type ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface FieldControlProps {
  id: string;
  'aria-invalid': boolean | undefined;
  'aria-describedby': string | undefined;
}

interface FormFieldProps {
  label: string;
  error?: string | undefined;
  hint?: string | undefined;
  required?: boolean;
  /** Keeps the label for screen readers only, for a repeated row under a visible header. */
  hideLabel?: boolean;
  /** Beside the label, on the right: a derived value such as the Hijri day of a date. */
  aside?: ReactNode;
  className?: string;
  /** Render prop so the field wires id and ARIA onto any control. */
  children: (control: FieldControlProps) => ReactElement;
}

/** Label + control + hint + error with correct accessibility wiring. Layout only, no form logic. */
export function FormField({
  label,
  error,
  hint,
  required = false,
  hideLabel = false,
  aside,
  className,
  children,
}: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <div className={cn('flex items-baseline justify-between gap-2', hideLabel && 'contents')}>
        <label htmlFor={id} className={cn(hideLabel ? 'sr-only' : 'text-foreground text-meta font-medium')}>
          {label}
          {required && (
            <span aria-hidden className="text-muted">
              {' '}
              *
            </span>
          )}
        </label>
        {aside && !hideLabel && <span className="text-accent truncate text-xs font-medium">{aside}</span>}
      </div>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="text-muted text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-danger-strong text-xs">
          {error}
        </p>
      )}
    </div>
  );
}
