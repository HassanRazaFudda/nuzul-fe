import { Loader2 } from 'lucide-react';
import type { ComponentPropsWithRef, ReactNode } from 'react';

import { cn } from '@/lib/cn';

import { buttonClass, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  /** Shows a spinner and blocks further clicks while work is under way. */
  isLoading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  isLoading = false,
  disabled,
  type = 'button', // never submit a form by accident
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled === true || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(buttonClass(variant, size), className)}
      {...rest}
    >
      {isLoading ? <Loader2 aria-hidden className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
