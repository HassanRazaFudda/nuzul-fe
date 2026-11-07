import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

const TONE_CLASSES = {
  neutral: 'border-neutral-border bg-neutral-subtle text-neutral-strong',
  brand: 'border-primary-border bg-primary-subtle text-primary-strong',
  success: 'border-success-border bg-success-subtle text-success-strong',
  warning: 'border-warning-border bg-warning-subtle text-warning-strong',
  danger: 'border-danger-border bg-danger-subtle text-danger-strong',
} as const;

export type BadgeTone = keyof typeof TONE_CLASSES;

interface BadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', icon, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
      )}
    >
      {icon}
      {children}
    </span>
  );
}
