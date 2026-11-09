import { cn } from '@/lib/cn';

const VARIANT_CLASSES = {
  primary: 'bg-primary text-primary-foreground shadow-raised hover:bg-primary-hover active:bg-primary-active',
  secondary: 'border border-border-strong bg-surface text-foreground shadow-raised hover:bg-surface-muted',
  ghost: 'text-secondary hover:bg-surface-muted hover:text-foreground',
  danger: 'bg-danger text-danger-foreground shadow-raised hover:bg-danger-hover',
  /** A destructive action that is not the main one, like Cancel contract in a header. */
  'danger-ghost': 'text-danger-strong hover:bg-danger-subtle',
} as const;

const SIZE_CLASSES = {
  sm: 'h-(--control-height-sm) gap-1.5 px-3 text-[0.8125rem]',
  md: 'h-(--control-height) gap-2 px-4 text-sm',
} as const;

export type ButtonVariant = keyof typeof VARIANT_CLASSES;
export type ButtonSize = keyof typeof SIZE_CLASSES;

/** Button looks, shared with links that act as buttons. */
export function buttonClass(variant: ButtonVariant = 'primary', size: ButtonSize = 'md'): string {
  return cn(
    'inline-flex items-center justify-center rounded-control font-medium whitespace-nowrap transition-[color,background-color,transform] duration-150 ease-out active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
  );
}

/** A text link: ink with a quiet underline that darkens on hover. */
export const LINK_CLASS =
  'text-foreground underline decoration-border-strong underline-offset-[3px] transition-colors duration-150 hover:decoration-foreground';

/** A figure that opens the detail behind it: underlined only on hover, so numbers stay calm. */
export const FIGURE_LINK_CLASS =
  'underline-offset-4 decoration-1 transition-colors duration-150 hover:underline';

/** A record number that links to its page, like PUR-0001. */
export const RECORD_LINK_CLASS = cn(LINK_CLASS, 'font-mono text-[0.8125rem] font-medium');
