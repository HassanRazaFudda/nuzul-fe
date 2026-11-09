import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  /** Context a detail page needs, like whose contract it is. List pages go without. */
  subtitle?: ReactNode;
  /** The record's state, shown beside the title. */
  status?: ReactNode;
  action?: ReactNode;
}

/** The heading at the top of every screen, and the browser tab's title. */
export function PageHeader({ title, subtitle, status, action }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-5 pt-6 lg:px-8 lg:pt-8">
      <title>{`${title} · Nuzul`}</title>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <h1 className="text-foreground text-2xl leading-tight font-semibold">{title}</h1>
          {status}
        </div>
        {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
