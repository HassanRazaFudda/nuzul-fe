import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { mockDb } from '@/mock-api/db';

/** The prototype keeps sample data in this browser; this puts it back as it started. */
export function SampleDataNote() {
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  async function handleReset() {
    setIsResetting(true);
    await mockDb.resetToSeed();
    await queryClient.invalidateQueries();
    setIsResetting(false);
    setIsConfirming(false);
  }

  return (
    <>
      <p className="border-border text-muted border-t px-7 pt-3 text-xs">
        Sample data ·{' '}
        <button
          type="button"
          onClick={() => {
            setIsConfirming(true);
          }}
          className="hover:text-foreground underline underline-offset-2"
        >
          Reset
        </button>
      </p>
      <ConfirmDialog
        open={isConfirming}
        onCancel={() => {
          setIsConfirming(false);
        }}
        onConfirm={() => void handleReset()}
        title="Reset sample data?"
        confirmLabel="Reset"
        tone="danger"
        isBusy={isResetting}
      >
        Everything entered in this browser is replaced with the original sample data. This cannot be undone.
      </ConfirmDialog>
    </>
  );
}
