import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface DetailProps {
  label: string;
  className?: string;
  children: ReactNode;
}

/** One fact in a <dl>: a quiet label over its value. */
export function Detail({ label, className, children }: DetailProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-muted text-meta">{label}</dt>
      <dd className="text-foreground mt-0.5 text-sm">{children}</dd>
    </div>
  );
}
