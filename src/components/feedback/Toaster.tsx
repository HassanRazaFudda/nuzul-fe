import { CheckCircle2 } from 'lucide-react';
import { useSyncExternalStore } from 'react';

import { getToast, subscribeToast } from './toast';

export function Toaster() {
  const message = useSyncExternalStore(subscribeToast, getToast);
  return (
    <div role="status" aria-live="polite" className="fixed end-4 bottom-4 z-50">
      {message && (
        <div className="rounded-card border-border bg-surface text-foreground shadow-overlay flex items-center gap-2 border px-4 py-3 text-sm">
          <CheckCircle2 aria-hidden className="text-success-strong size-4" />
          {message}
        </div>
      )}
    </div>
  );
}
