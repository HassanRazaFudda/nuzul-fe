import { MoreHorizontal } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useNavigate } from 'react-router';

import { cn } from '@/lib/cn';

import { buttonClass, ICON_BUTTON_CLASS, type ButtonSize, type ButtonVariant } from './buttonStyles';

export interface MenuItem {
  label: string;
  /** A page to open, or a function to run. */
  to?: string | undefined;
  onSelect?: (() => void) | undefined;
  icon?: ReactNode | undefined;
  /** Destructive: red, and set apart from the items above it. */
  tone?: 'danger' | undefined;
  disabled?: boolean | undefined;
  /** Shown under the label, for what the item does when that is not obvious. */
  hint?: string | undefined;
}

interface MenuProps {
  /** Accessible name for the trigger, such as "More actions for PUR-0003". */
  label: string;
  items: readonly (MenuItem | false | null | undefined)[];
  /** Visible trigger text. Without it the trigger is a "…" icon button. */
  triggerLabel?: string;
  triggerIcon?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  align?: 'start' | 'end';
  className?: string;
}

const ITEM_CLASS =
  'flex w-full items-start gap-2.5 rounded-[0.3125rem] px-2.5 py-1.5 text-start text-sm outline-none transition-colors duration-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-45 [&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0';

interface Position {
  top: number;
  left?: number;
  right?: number;
}

/**
 * A short list of actions behind one button, for the actions a screen offers but rarely needs:
 * Lock, Terminate, Cancel. Fixed beside its trigger so no table or card clips it; Esc, a click
 * elsewhere, Tab or a scroll closes it, and focus goes back to the trigger.
 */
export function Menu({
  label,
  items,
  triggerLabel,
  triggerIcon,
  variant = 'secondary',
  size = 'md',
  align = 'end',
  className,
}: MenuProps) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);
  const navigate = useNavigate();
  const visible = items.filter((item): item is MenuItem => Boolean(item));
  const isOpen = position !== null;

  // Clicks, keys and scrolling elsewhere on the page are outside React, so an effect listens.
  useEffect(() => {
    if (!isOpen) return;
    const close = () => {
      setPosition(null);
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return;
      close();
    };
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      close();
      triggerRef.current?.focus();
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    window.addEventListener('scroll', close, { capture: true, passive: true });
    window.addEventListener('resize', close);
    requestAnimationFrame(() => {
      menuRef.current?.querySelector<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)')?.focus();
    });
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('scroll', close, { capture: true });
      window.removeEventListener('resize', close);
    };
  }, [isOpen]);

  function toggle() {
    if (isOpen) {
      setPosition(null);
      return;
    }
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      align === 'end'
        ? { top: rect.bottom + 4, right: window.innerWidth - rect.right }
        : { top: rect.bottom + 4, left: rect.left },
    );
  }

  function focusItem(step: 1 | -1 | 'first' | 'last') {
    const buttons = [
      ...(menuRef.current?.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not(:disabled)') ??
        []),
    ];
    if (buttons.length === 0) return;
    const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
    let next = 0;
    if (step === 'first') next = 0;
    else if (step === 'last') next = buttons.length - 1;
    else next = (current + step + buttons.length) % buttons.length;
    buttons[next]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem(-1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusItem('first');
    } else if (event.key === 'End') {
      event.preventDefault();
      focusItem('last');
    } else if (event.key === 'Tab') {
      setPosition(null);
    }
  }

  function select(item: MenuItem) {
    setPosition(null);
    triggerRef.current?.focus();
    if (item.to) void navigate(item.to);
    item.onSelect?.();
  }

  const firstDanger = visible.findIndex((item) => item.tone === 'danger');
  if (visible.length === 0) return null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `${id}-menu` : undefined}
        aria-label={triggerLabel ? undefined : label}
        title={triggerLabel ? undefined : label}
        onClick={(event) => {
          event.stopPropagation();
          toggle();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' && !isOpen) {
            event.preventDefault();
            toggle();
          }
        }}
        className={cn(triggerLabel ? buttonClass(variant, size) : ICON_BUTTON_CLASS, className)}
      >
        {triggerIcon ?? (triggerLabel ? null : <MoreHorizontal aria-hidden />)}
        {triggerLabel}
      </button>
      {position && (
        <div
          ref={menuRef}
          id={`${id}-menu`}
          role="menu"
          tabIndex={-1}
          aria-label={label}
          onKeyDown={handleKeyDown}
          onClick={(event) => {
            event.stopPropagation();
          }}
          style={{
            top: position.top,
            left: position.left ?? 'auto',
            right: position.right ?? 'auto',
          }}
          className="border-border bg-surface shadow-popover animate-pop-in fixed z-50 min-w-48 rounded-lg border p-1"
        >
          {visible.map((item, index) => (
            <div key={item.label}>
              {index === firstDanger && index > 0 && <div className="bg-border -mx-1 my-1 h-px" />}
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  select(item);
                }}
                className={cn(
                  ITEM_CLASS,
                  item.tone === 'danger'
                    ? 'text-danger-strong hover:bg-danger-subtle focus-visible:bg-danger-subtle'
                    : 'text-foreground hover:bg-surface-muted focus-visible:bg-surface-muted',
                )}
              >
                {item.icon}
                <span className="min-w-0">
                  <span className="block">{item.label}</span>
                  {item.hint && <span className="text-muted block text-xs">{item.hint}</span>}
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
