import type { ReactNode } from 'react';

import { Button } from './Button';
import { Dialog } from './Dialog';

interface ConfirmDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  /** States the consequence, with the numbers that change, not "Are you sure?". */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: 'default' | 'danger';
  isBusy?: boolean;
  /** When going ahead is not allowed; the text says why. */
  isConfirmDisabled?: boolean;
}

/** Asks before anything hard to undo. */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'default',
  isBusy = false,
  isConfirmDisabled = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={isBusy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            onClick={onConfirm}
            isLoading={isBusy}
            disabled={isConfirmDisabled}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children}
    </Dialog>
  );
}
