import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}

/** The heading at the top of every screen, and the browser tab's title. */
export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="border-border bg-surface flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4 lg:px-8">
      <title>{`${title} · Nuzul`}</title>
      <div className="min-w-0">
        <h1 className="text-foreground text-lg font-bold">{title}</h1>
        {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}
