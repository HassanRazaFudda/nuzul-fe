import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_CLASS } from './controlStyles';

export function Select({ className, ...rest }: ComponentPropsWithRef<'select'>) {
  return <select className={cn(CONTROL_CLASS, 'h-(--control-height)', className)} {...rest} />;
}
