import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

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
   * `dot` is a state: a coloured dot and the word. `text` is the word alone in its colour,
   * for something that needs a look, like an overbooked line.
   */
  look?: 'dot' | 'text';
  /** Replaces the dot. */
  icon?: ReactNode;
  children: ReactNode;
}

/** A state in words. The colour only repeats what the words say. */
export function Badge({ tone = 'neutral', look = 'dot', icon, children }: BadgeProps) {
  if (look === 'text') {
    return (
      <span className={cn('text-[0.8125rem] font-medium whitespace-nowrap', TEXT_CLASSES[tone])}>
        {children}
      </span>
    );
  }
  return (
    <span className="text-secondary inline-flex items-center gap-1.5 text-[0.8125rem] font-medium whitespace-nowrap">
      {icon ?? <span aria-hidden className={cn('size-1.5 shrink-0 rounded-full', DOT_CLASSES[tone])} />}
      {children}
    </span>
  );
}
