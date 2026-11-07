import { AlertTriangle } from 'lucide-react';
import type { ReactNode } from 'react';

interface ErrorNoticeProps {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}

/** An error the user should read, with a way forward. */
export function ErrorNotice({ title, children, action }: ErrorNoticeProps) {
  return (
    <div role="alert" className="rounded-card border-danger-border bg-danger-subtle flex gap-3 border p-4">
      <AlertTriangle aria-hidden className="text-danger-strong mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="text-foreground text-sm font-semibold">{title}</p>
        {children && <div className="text-muted mt-1 text-sm">{children}</div>}
        {action && <div className="mt-3">{action}</div>}
      </div>
    </div>
  );
}
