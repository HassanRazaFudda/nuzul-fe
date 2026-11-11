import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const PILL_CLASSES = {
  neutral: 'bg-surface-muted text-secondary',
  success: 'bg-success-subtle text-success-strong',
  warning: 'bg-warning-subtle text-warning-strong',
  danger: 'bg-danger-subtle text-danger-strong',
} as const;

const DOT_CLASSES = {
  neutral: 'bg-neutral',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-danger',
} as const;

const TEXT_CLASSES = {
  neutral: 'text-secondary',
  success: 'text-success-strong',
  warning: 'text-warning-strong',
  danger: 'text-danger-strong',
} as const;

export type BadgeTone = keyof typeof DOT_CLASSES;

interface BadgeProps {
  tone?: BadgeTone;
  /**
   * `pill` (default) is a record's state or a flag: a soft tinted pill. `dot` is a state in a
   * dense table: a coloured dot and the word. `text` is the word alone in its colour.
   */
  look?: 'pill' | 'dot' | 'text';
  /** Replaces the dot. */
  icon?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** A state in words. The colour only repeats what the words say. */
export function Badge({ tone = 'neutral', look = 'pill', icon, className, children }: BadgeProps) {
  if (look === 'text') {
    return (
      <span className={cn('text-meta font-medium whitespace-nowrap', TEXT_CLASSES[tone], className)}>
        {children}
      </span>
    );
  }
  if (look === 'pill') {
    return (
      <span
        className={cn(
          'rounded-pill inline-flex h-5.5 items-center gap-1.5 px-2 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
          PILL_CLASSES[tone],
          className,
        )}
      >
        {icon ?? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} />}
        {children}
      </span>
    );
  }
  return (
    <span
      className={cn('text-secondary text-meta inline-flex items-center gap-1.5 whitespace-nowrap', className)}
    >
      {icon ?? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}
