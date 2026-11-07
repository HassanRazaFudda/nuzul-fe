import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { Card } from './Card';

interface StatProps {
  label: string;
  value: ReactNode;
  hint?: string;
  /** Colours only a problem value. */
  tone?: 'danger';
}

/** One figure on a summary row. */
export function Stat({ label, value, hint, tone }: StatProps) {
  return (
    <Card className="px-5 py-4">
      <p className="text-muted text-xs font-medium">{label}</p>
      <p
        className={cn(
          'mt-1 text-2xl font-semibold tabular-nums',
          tone === 'danger' ? 'text-danger-strong' : 'text-foreground',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted mt-1 text-xs">{hint}</p>}
    </Card>
  );
}
