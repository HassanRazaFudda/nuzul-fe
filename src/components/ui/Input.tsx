import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_CLASS } from './controlStyles';

export function Input({ className, ...rest }: ComponentPropsWithRef<'input'>) {
  return <input className={cn(CONTROL_CLASS, 'h-(--control-height)', className)} {...rest} />;
}
