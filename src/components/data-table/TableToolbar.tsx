import { Rows3, Search } from 'lucide-react';
import type { ReactNode, SubmitEvent } from 'react';

import { Input } from '@/components/ui/Input';
import { cn } from '@/lib/cn';

interface TableToolbarProps {
  label: string;
  /** What is typed in the search box. */
  draft: string;
  onDraftChange: (draft: string) => void;
  /** Enter: search at once instead of waiting for typing to pause. */
  onSubmit: () => void;
  isCompact: boolean;
  onCompactChange: (isCompact: boolean) => void;
  children?: ReactNode;
}

/** Search box and density switch above a table. */
export function TableToolbar({
  label,
  draft,
  onDraftChange,
  onSubmit,
  isCompact,
  onCompactChange,
  children,
}: TableToolbarProps) {
  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <form role="search" onSubmit={handleSubmit} className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search
          aria-hidden
          className="text-muted pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={draft}
          onChange={(event) => {
            onDraftChange(event.target.value);
          }}
          placeholder="Search"
          aria-label={`Search ${label}`}
          className="h-(--control-height-sm) ps-9"
        />
      </form>
      {children}
      <button
        type="button"
        aria-pressed={isCompact}
        aria-label="Compact rows"
        title="Compact rows"
        onClick={() => {
          onCompactChange(!isCompact);
        }}
        className={cn(
          'rounded-control ms-auto p-1.5 transition-colors duration-150',
          isCompact
            ? 'bg-surface-muted text-foreground'
            : 'text-muted hover:bg-surface-muted hover:text-foreground',
        )}
      >
        <Rows3 aria-hidden className="size-4" />
      </button>
    </div>
  );
}
