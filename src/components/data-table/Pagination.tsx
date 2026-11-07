import { Button } from '@/components/ui/Button';
import type { PaginationMeta } from '@/lib/api/pagination';

interface PaginationProps {
  meta: PaginationMeta;
  onPageChange: (page: number) => void;
}

export function Pagination({ meta, onPageChange }: PaginationProps) {
  const { page, pageSize, totalPages, totalItems } = meta;
  const first = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalItems);

  return (
    <nav
      aria-label="Pagination"
      className="border-border text-muted flex flex-wrap items-center justify-between gap-2 border-t px-4 py-2.5 text-xs"
    >
      <p className="tabular-nums" aria-live="polite">
        {first}–{last} of {totalItems}
      </p>
      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
          >
            Previous
          </Button>
          <span className="px-2 tabular-nums">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </nav>
  );
}
