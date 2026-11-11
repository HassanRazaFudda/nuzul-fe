import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Colours only a problem value. */
  tone?: 'danger';
}

/** One figure in a summary strip: its label, the number, and what it compares to. */
export function Stat({ label, value, hint, tone }: StatProps) {
  return (
    <div className="bg-surface min-w-0 px-4 py-3">
      <p className="text-muted text-meta truncate">{label}</p>
      <p
        className={cn(
          'mt-0.5 text-base leading-6 font-semibold tracking-[-0.01em] tabular-nums sm:truncate sm:text-lg sm:leading-7',
          tone === 'danger' ? 'text-danger-strong' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted truncate text-xs">{hint}</p>}
    </div>
  );
}

/** The key figures of a page, side by side on one surface with hairlines between them. */
export function SummaryStrip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      aria-label="Summary"
      className={cn(
        'rounded-card border-border bg-border shadow-raised grid grid-cols-2 gap-px overflow-hidden border lg:auto-cols-fr lg:grid-flow-col lg:grid-cols-none',
        // An odd figure out on a narrow screen takes the whole row instead of leaving a gap.
        '[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1',
        className,
      )}
    >
      {children}
    </section>
  );
}
