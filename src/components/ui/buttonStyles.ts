import { cn } from '@/lib/cn';

const VARIANT_CLASSES = {
  primary: 'bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border border-border-strong bg-surface text-foreground hover:bg-surface-muted',
  soft: 'border border-primary-border bg-primary-subtle text-primary-strong hover:bg-primary-subtle-hover',
  ghost: 'text-muted hover:bg-background hover:text-foreground',
  danger: 'bg-danger text-danger-foreground shadow-raised hover:bg-danger-hover',
} as const;

const SIZE_CLASSES = {
  sm: 'h-(--control-height-sm) gap-1.5 px-3 text-xs',
  md: 'h-(--control-height) gap-2 px-4 text-sm',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

/** Button looks, shared with links that act as buttons. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return cn(
    'inline-flex items-center justify-center rounded-control font-medium whitespace-nowrap transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
  );
}
