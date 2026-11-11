import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentPropsWithRef<'section'>) {
  return (
    <section
      className={cn('rounded-card border-border bg-surface shadow-raised border', className)}
      {...rest}
    />
  );
}

interface CardHeaderProps {
  title: string;
  /** Only when the title alone would mislead. */
  subtitle?: string | undefined;
  /** A figure or note beside the title, such as a count. */
  meta?: ReactNode | undefined;
  action?: ReactNode | undefined;
  /** A hairline under the header, for a header above a table. */
  divided?: boolean;
}

export function CardHeader({ title, subtitle, meta, action, divided = false }: CardHeaderProps) {
  return (
    <header
      className={cn(
        'flex min-h-12 flex-wrap items-center justify-between gap-x-3 gap-y-1.5 px-4 py-2.5',
        divided && 'border-border border-b',
      )}
    >
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <h2 className="text-foreground text-sm font-semibold">{title}</h2>
          {meta && <span className="text-muted text-meta tabular-nums">{meta}</span>}
        </div>
        {subtitle && <p className="text-muted text-meta">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-1.5">{action}</div>}
    </header>
  );
}
