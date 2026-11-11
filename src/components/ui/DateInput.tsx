import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_CLASS } from './controlStyles';

/**
 * A date field in the shared look. The Hijri day of the picked date goes beside the label,
 * through FormField's `aside`, so the date itself is never squeezed.
 */
export function DateInput({ className, ...rest }: Omit<ComponentPropsWithRef<'input'>, 'type'>) {
  return (
    <input
      type="date"
      className={cn(CONTROL_CLASS, 'h-(--control-height) tabular-nums', className)}
      {...rest}
    />
  );
}
