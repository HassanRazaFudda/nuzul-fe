import { useId, useState, type ReactNode, type SubmitEvent } from 'react';
import { useFormState, type FieldValues, type Path, type UseFormReturn } from 'react-hook-form';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { getErrorMessage } from '@/lib/api/api-error';

interface FormDialogProps<TInput extends FieldValues, TOutput> {
  form: UseFormReturn<TInput, unknown, TOutput>;
  /** Field names to their labels, for the error summary. */
  labels: Partial<Record<Path<TInput>, string>>;
  title: string;
  submitLabel?: string;
  onClose: () => void;
  /** Must reject on failure, so the error stays on screen. */
  onValid: (values: TOutput) => Promise<void>;
  children: ReactNode;
}

/**
 * A form in a dialog, with the behaviour every form shares: after a failed submit, focus on
 * the first bad field and an announced summary linking to each one; a save error kept on
 * screen; and a question before throwing away unsaved work. Mount it only while open, so
 * each opening starts from the record it was given.
 */
export function FormDialog<TInput extends FieldValues, TOutput>({
  form,
  labels,
  title,
  submitLabel = 'Save',
  onClose,
  onValid,
  children,
}: FormDialogProps<TInput, TOutput>) {
  const formId = useId();
  const [showSummary, setShowSummary] = useState(false);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  // useFormState, not form.formState: the Compiler memoises on the stable `form` object,
  // so reading through it can go stale.
  const formState = useFormState({ control: form.control });
  const { isDirty, isSubmitting } = formState;

  const labelled = Object.keys(labels) as Path<TInput>[];
  const invalid = labelled.filter((name) => form.getFieldState(name, formState).invalid);

  function handleClose() {
    if (isDirty) setIsConfirmingDiscard(true);
    else onClose();
  }

  function handleSubmit(event: SubmitEvent) {
    void form.handleSubmit(
      async (values) => {
        setSaveError(null);
        try {
          await onValid(values);
        } catch (error) {
          setSaveError(error);
        }
      },
      () => {
        setShowSummary(true);
      },
    )(event);
  }

  return (
    <>
      <Dialog
        open
        title={title}
        onClose={handleClose}
        footer={
          <>
            <Button variant="secondary" disabled={isSubmitting} onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit" form={formId} isLoading={isSubmitting}>
              {submitLabel}
            </Button>
          </>
        }
      >
        <form id={formId} noValidate onSubmit={handleSubmit} className="space-y-4">
          {saveError !== null && (
            <ErrorNotice title="This could not be saved">{getErrorMessage(saveError)}</ErrorNotice>
          )}
          {showSummary && invalid.length > 0 && (
            <div role="alert" className="rounded-card border-danger-border bg-danger-subtle border p-3">
              <p className="text-foreground text-sm font-semibold">Please fix these first</p>
              <ul className="mt-1 space-y-0.5">
                {invalid.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => {
                        form.setFocus(name);
                      }}
                      className="text-danger-strong text-start text-sm underline"
                    >
                      {labels[name]}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {children}
        </form>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingDiscard}
        onCancel={() => {
          setIsConfirmingDiscard(false);
        }}
        onConfirm={onClose}
        title="Discard your changes?"
        confirmLabel="Discard"
        tone="danger"
      >
        What you entered in this form has not been saved.
      </ConfirmDialog>
    </>
  );
}
