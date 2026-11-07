import type { ComponentPropsWithRef } from 'react';

import { cn } from '@/lib/cn';

import { CONTROL_CLASS } from './controlStyles';

export function Textarea({ className, ...rest }: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={cn(CONTROL_CLASS, 'min-h-24 py-2 leading-relaxed', className)} {...rest} />;
}
