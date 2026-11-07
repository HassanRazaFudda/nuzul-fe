import { Rows3, Search } from 'lucide-react';
import { useState, type ReactNode, type SubmitEvent } from 'react';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

interface TableToolbarProps {
  /** The committed search. Render with `key={search}` so the draft resets if the URL changes. */
  search: string;
  onSearch: (search: string) => void;
  label: string;
  isCompact: boolean;
  onCompactChange: (isCompact: boolean) => void;
  children?: ReactNode;
}

/** Search box and density switch above a table. Typing stays local until submitted. */
export function TableToolbar({
  search,
  onSearch,
  label,
  isCompact,
  onCompactChange,
  children,
}: TableToolbarProps) {
  const [draft, setDraft] = useState(search);

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    onSearch(draft);
  }

  return (
    <div className="border-border flex flex-wrap items-center gap-2 border-b px-4 py-3">
      <form role="search" onSubmit={handleSubmit} className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search
          aria-hidden
          className="text-faint pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2"
        />
        <Input
          type="search"
          value={draft}
          onChange={(event) => {
            setDraft(event.target.value);
            // Clearing the box is a search too; no need to press Enter for it.
            if (event.target.value === '') onSearch('');
          }}
          placeholder="Search, then press Enter"
          aria-label={`Search ${label}`}
          className="ps-9"
        />
      </form>
      {children}
      <Button
        variant="ghost"
        size="sm"
        className="ms-auto"
        icon={<Rows3 aria-hidden className="size-4" />}
        aria-pressed={isCompact}
        onClick={() => {
          onCompactChange(!isCompact);
        }}
      >
        Compact
      </Button>
    </div>
  );
}
