import { cn } from '@/lib/cn';

export interface TabBarItem<TValue extends string> {
  value: TValue;
  label: string;
  count?: number | undefined;
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
    <div role="tablist" aria-label={label} className="flex gap-6 overflow-x-auto overflow-y-hidden border-b">
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
              '-mb-px border-b-2 px-1 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors duration-150',
              isSelected
                ? 'border-accent text-foreground font-medium'
                : 'text-muted hover:text-foreground border-transparent',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span className="text-muted ms-1.5 font-mono text-xs">{item.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
