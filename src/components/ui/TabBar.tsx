import { cn } from '@/lib/cn';

export interface TabBarItem<TValue extends string> {
  value: TValue;
  label: string;
  count?: number | undefined;
  /** Marks a count that needs a look, like drafts waiting. */
  isAttention?: boolean;
}

interface TabBarProps<TValue extends string> {
  label: string;
  items: readonly TabBarItem<TValue>[];
  value: TValue;
  onChange: (value: TValue) => void;
}

/** A row of tabs. The owner keeps which one is active, usually in the URL. */
export function TabBar<TValue extends string>({ label, items, value, onChange }: TabBarProps<TValue>) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="border-border flex gap-5 overflow-x-auto overflow-y-hidden border-b"
    >
      {items.map((item) => {
        const isSelected = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(item.value)}
            className={cn(
              '-mb-px inline-flex items-center gap-1.5 border-b-2 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors duration-150',
              isSelected
                ? 'border-foreground text-foreground font-medium'
                : 'text-muted hover:text-foreground border-transparent',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-pill text-2xs min-w-5 px-1.5 text-center leading-[1.125rem] font-medium tabular-nums',
                  item.isAttention && item.count > 0
                    ? 'bg-warning-subtle text-warning-strong'
                    : isSelected
                      ? 'bg-surface-muted text-foreground'
                      : 'bg-surface-muted text-muted',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
