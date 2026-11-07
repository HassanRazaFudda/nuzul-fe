import { Loader2 } from 'lucide-react';

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div role="status" className="text-muted flex items-center justify-center gap-2 py-16 text-sm">
      <Loader2 aria-hidden className="size-4 animate-spin" />
      {label}
    </div>
  );
}
