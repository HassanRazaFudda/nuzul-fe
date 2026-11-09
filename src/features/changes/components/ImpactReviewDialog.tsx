import { useId, useState } from 'react';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { FormField } from '@/components/form/FormField';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import type { CalendarMonth } from '@/features/calendar';
import { getErrorMessage } from '@/lib/api/api-error';

import type { Impact } from '../domain/impact';
import { ImpactPreview, type ImpactNames } from './ImpactPreview';

const MAX_REASON_LENGTH = 500;

interface ImpactReviewDialogProps {
  title: string;
  impact: Impact;
  names: ImpactNames;
  months: CalendarMonth[];
  confirmLabel: string;
  /** Holds `inventory.override_overbooking`. Without it, a change that overbooks cannot be saved. */
  canOverride: boolean;
  /** Must reject on failure, so the error stays on screen. */
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * The last step of every change to a Confirmed record: what it does to the ledger, and why.
 * Overbooking warns and asks; it never blocks. Mount it only while open.
 */
export function ImpactReviewDialog({
  title,
  impact,
  names,
  months,
  confirmLabel,
  canOverride,
  onConfirm,
  onCancel,
}: ImpactReviewDialogProps) {
  const formId = useId();
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>();
  const [saveError, setSaveError] = useState<unknown>(null);
  const [isBusy, setIsBusy] = useState(false);
  const isBlocked = impact.worsens && !canOverride;

  async function handleConfirm() {
    const trimmed = reason.trim();
    if (trimmed === '') {
      setReasonError('Enter the reason for this change');
      return;
    }
    setReasonError(undefined);
    setSaveError(null);
    setIsBusy(true);
    try {
      await onConfirm(trimmed);
    } catch (error) {
      setSaveError(error);
      setIsBusy(false);
    }
  }

  return (
    <Dialog
      open
      size="lg"
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" disabled={isBusy} onClick={onCancel}>
            Go back
          </Button>
          <Button
            type="submit"
            form={formId}
            variant={impact.worsens ? 'danger' : 'primary'}
            isLoading={isBusy}
            disabled={isBlocked}
          >
            {impact.worsens ? `${confirmLabel} with overbooking` : confirmLabel}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        noValidate
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          void handleConfirm();
        }}
      >
        {saveError !== null && (
          <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
        )}
        {impact.worsens && (
          <ErrorNotice title="This overbooks">
            {isBlocked
              ? 'Some nights below end up short, and going ahead with overbooking needs a permission you do not hold. Ask someone who has it, or change the record so nothing is short.'
              : 'Some nights below end up short. You can still go ahead; the sales on them are tagged Overbooked.'}
          </ErrorNotice>
        )}
        <ImpactPreview impact={impact} names={names} months={months} />
        <FormField label="Reason" required error={reasonError} hint="Kept in the record's history">
          {(field) => (
            <Textarea
              {...field}
              maxLength={MAX_REASON_LENGTH}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          )}
        </FormField>
      </form>
    </Dialog>
  );
}
