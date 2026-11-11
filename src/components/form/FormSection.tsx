import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface FormSectionProps {
  /** Left out when the one field inside already names it. */
  title?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** One part of a long form. Parts share a surface and are split by a hairline, not boxed. */
export function FormSection({ title, action, className, children }: FormSectionProps) {
  return (
    <section className={cn('border-border space-y-4 border-t p-4 first:border-t-0', className)}>
      {(title ?? action) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-foreground text-sm font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
