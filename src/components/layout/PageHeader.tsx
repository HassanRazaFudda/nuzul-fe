import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

export interface Crumb {
  label: string;
  to: string;
}

interface PageHeaderProps {
  title: string;
  /** Context a detail page needs, like whose contract it is. List pages go without. */
  subtitle?: ReactNode;
  /** The record's state, shown beside the title. */
  status?: ReactNode;
  action?: ReactNode;
  /** Where this page sits, for a detail or form page: "Purchases" above "PUR-0003". */
  breadcrumbs?: readonly Crumb[];
  /** The browser tab's title, when it should differ from the heading. */
  documentTitle?: string;
}

/** The heading at the top of every screen, and the browser tab's title. */
export function PageHeader({ title, subtitle, status, action, breadcrumbs, documentTitle }: PageHeaderProps) {
  return (
    <header className="px-(--page-gutter) pt-5 pb-1 lg:pt-7">
      <title>{`${documentTitle ?? title} · Nuzul`}</title>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav aria-label="Breadcrumb" className="mb-1.5">
          <ol className="text-muted text-meta flex flex-wrap items-center gap-1">
            {breadcrumbs.map((crumb) => (
              <li key={crumb.to} className="flex items-center gap-1">
                <Link to={crumb.to} className="hover:text-foreground transition-colors duration-150">
                  {crumb.label}
                </Link>
                <ChevronRight aria-hidden className="text-faint size-3.5" />
              </li>
            ))}
          </ol>
        </nav>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <div className="flex min-h-9 flex-wrap items-center gap-x-2.5 gap-y-1">
            <h1 className="text-foreground text-xl leading-tight font-semibold tracking-[-0.015em]">
              {title}
            </h1>
            {status}
          </div>
          {subtitle && <div className="text-muted mt-0.5 text-sm">{subtitle}</div>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </header>
  );
}

/** The body of a page under its header, with the shared gutters and rhythm. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`space-y-5 px-(--page-gutter) pt-4 pb-10 ${className ?? ''}`}>{children}</div>;
}
