import { AlertTriangle, Info } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface CalloutProps {
  tone?: 'danger' | 'warning' | 'neutral';
  title: string;
  children?: ReactNode;
  /** The action that resolves what the callout reports. */
  action?: ReactNode;
  className?: string;
}

const TONES = {
  danger: { box: 'border-danger-border bg-danger-subtle', icon: 'text-danger', Icon: AlertTriangle },
  warning: {
    box: 'border-warning-border bg-warning-subtle',
    icon: 'text-warning-strong',
    Icon: AlertTriangle,
  },
  neutral: { box: 'border-border bg-surface-raised', icon: 'text-muted', Icon: Info },
} as const;

/**
 * A problem on this record, said once, with the action that fixes it beside it. Not for
 * errors from a save: those use ErrorNotice.
 */
export function Callout({ tone = 'warning', title, children, action, className }: CalloutProps) {
  const { box, icon, Icon } = TONES[tone];
  return (
    <div
      role={tone === 'neutral' ? undefined : 'status'}
      className={cn(
        'rounded-card flex flex-wrap items-start gap-x-3 gap-y-2 border px-4 py-3',
        box,
        className,
      )}
    >
      <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">{title}</p>
        {children && <div className="text-secondary text-meta mt-0.5">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </div>
  );
}
