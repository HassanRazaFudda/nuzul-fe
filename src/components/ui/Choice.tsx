import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'type' | 'className'>;

/**
 * An on/off setting, such as "Rate per night". A real checkbox underneath, so it works with
 * a form library's register and with the keyboard.
 */
export function Switch({ label, hint, ...rest }: InputProps & { label: ReactNode; hint?: ReactNode }) {
  return (
    <label className="group inline-flex cursor-pointer items-start gap-2.5 text-sm select-none">
      <input type="checkbox" role="switch" className="peer sr-only" {...rest} />
      <span
        aria-hidden
        className="bg-border-strong peer-checked:bg-foreground peer-focus-visible:outline-accent relative mt-0.5 h-4.5 w-8 shrink-0 rounded-full transition-colors duration-150 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50 peer-checked:[&>span]:translate-x-3.5"
      >
        <span className="bg-surface shadow-control absolute top-0.5 left-0.5 size-3.5 rounded-full transition-transform duration-150 ease-out" />
      </span>
      <span className="min-w-0">
        <span className="text-foreground block">{label}</span>
        {hint && <span className="text-muted block text-xs">{hint}</span>}
      </span>
    </label>
  );
}

interface SegmentOption {
  value: string;
  label: ReactNode;
}

/**
 * Two to four exclusive choices shown side by side, such as "By occupancy" and "Flat". Radio
 * buttons underneath, so a form library registers it like any radio group.
 */
export function Segmented({
  legend,
  options,
  register,
  className,
}: {
  legend: string;
  options: readonly SegmentOption[];
  /** The result of the form library's register for this field, or plain radio props. */
  register: InputProps;
  className?: string;
}) {
  return (
    <fieldset className={cn('max-w-full min-w-0', className)}>
      <legend className="sr-only">{legend}</legend>
      <div className="rounded-control border-border bg-surface-muted inline-flex min-h-(--control-height) max-w-full flex-wrap items-stretch gap-0.5 border p-0.5">
        {options.map((option) => (
          <label key={option.value} className="relative flex">
            <input type="radio" value={option.value} className="peer sr-only" {...register} />
            <span className="text-muted hover:text-foreground peer-checked:bg-surface peer-checked:text-foreground peer-checked:shadow-raised peer-checked:ring-border peer-focus-visible:outline-accent text-meta flex min-h-7.5 cursor-pointer items-center rounded-[0.3125rem] px-3 font-medium whitespace-nowrap transition-colors duration-150 peer-checked:ring-1 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-1">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
