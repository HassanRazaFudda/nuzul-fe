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
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-5 pt-4 pb-1">
      <div className="min-w-0">
        <h2 className="text-foreground text-[0.9375rem] font-semibold">{title}</h2>
        {subtitle && <p className="text-muted mt-0.5 text-[0.8125rem]">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
