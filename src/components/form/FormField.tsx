import { useId, type ReactElement } from 'react';

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
  className?: string;
  /** Render prop so the field wires id and ARIA onto any control. */
  children: (control: FieldControlProps) => ReactElement;
}

/** Label + control + hint + error with correct accessibility wiring. Layout only, no form logic. */
export function FormField({ label, error, hint, required = false, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-foreground text-sm font-medium">
        {label}
        {required && (
          <span aria-hidden className="text-danger-strong">
            {' '}
            *
          </span>
        )}
      </label>
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
