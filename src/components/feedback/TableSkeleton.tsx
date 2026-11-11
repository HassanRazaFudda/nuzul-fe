interface TableSkeletonProps {
  rows: number;
  columns: number;
}

export function TableSkeleton({ rows, columns }: TableSkeletonProps) {
  return (
    <div role="status" aria-label="Loading" className="space-y-3 p-4">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex gap-3">
          {Array.from({ length: columns }, (_, columnIndex) => (
            <div key={columnIndex} className="rounded-control bg-background h-5 flex-1 animate-pulse" />
          ))}
        </div>
      ))}
    </div>
  );
}
