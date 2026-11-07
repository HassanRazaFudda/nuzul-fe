import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

export function Card({ className, ...rest }: ComponentPropsWithRef<'section'>) {
  return <section className={cn('rounded-card border-border bg-surface border', className)} {...rest} />;
}

interface CardHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <header className="border-border flex flex-wrap items-center justify-between gap-3 border-b px-5 py-3.5">
      <div className="min-w-0">
        <h2 className="text-foreground text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-muted mt-0.5 text-xs">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
