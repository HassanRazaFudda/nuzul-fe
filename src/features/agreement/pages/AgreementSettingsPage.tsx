import { zodResolver } from '@hookform/resolvers/zod';
import { useSuspenseQueries } from '@tanstack/react-query';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { useState, type SubmitEvent } from 'react';
import { useFieldArray, useForm, useFormState, type Path, type UseFormReturn } from 'react-hook-form';
import { Link, useBlocker } from 'react-router';
import { z } from 'zod';

import { ErrorNotice } from '@/components/feedback/ErrorNotice';
import { toast } from '@/components/feedback/toast';
import { FormErrorSummary } from '@/components/form/FormErrorSummary';
import { FormField } from '@/components/form/FormField';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Card, CardHeader } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { HistoryCard } from '@/features/changes';
import { roomTypesQuery } from '@/features/room-types';
import { getErrorMessage } from '@/lib/api/api-error';
import { useCan } from '@/lib/auth/session';

import { agreementSettingsQuery, useSaveAgreementSettings } from '../api/agreement.queries';
import { agreementSettingsSchema, type AgreementSettings } from '../api/agreement.schemas';

/** Bullets are edited as lines of text, one bullet per line. */
const formSchema = agreementSettingsSchema.extend({
  termsSections: z
    .array(
      z.object({
        heading: z.string().trim().min(1, 'Enter the heading').max(400),
        bullets: z.string().trim().min(1, 'Enter at least one bullet').max(6000),
      }),
    )
    .max(20),
});
type FormValues = z.infer<typeof formSchema>;

const toForm = (settings: AgreementSettings): FormValues => ({
  ...settings,
  termsSections: settings.termsSections.map((section) => ({
    ...section,
    bullets: section.bullets.join('\n'),
  })),
});

const fromForm = (values: FormValues): AgreementSettings => ({
  ...values,
  termsSections: values.termsSections.map((section) => ({
    heading: section.heading,
    bullets: section.bullets
      .split('\n')
      .map((bullet) => bullet.trim())
      .filter(Boolean),
  })),
});

const LABELS: Partial<Record<Path<FormValues>, string>> = {
  companyName: 'Company name',
  glNumber: 'G.L. No.',
  ceoName: 'Chief executive',
  ceoTitle: 'Title',
  signatory: 'Name in the signature',
  address: 'Address',
  phone: 'Phone',
  email: 'Email',
  seasonWord: 'Season word',
  recital: 'Recital',
  witness: 'Closing line',
};

type TextFieldName =
  | 'companyName'
  | 'glNumber'
  | 'ceoName'
  | 'ceoTitle'
  | 'signatory'
  | 'address'
  | 'phone'
  | 'email'
  | 'seasonWord'
  | 'witness';

function TextField({
  form,
  name,
  label,
  hint,
}: {
  form: UseFormReturn<FormValues>;
  name: TextFieldName;
  label: string;
  hint?: string;
}) {
  const { errors } = useFormState({ control: form.control, name });
  return (
    <FormField label={label} required error={errors[name]?.message} {...(hint ? { hint } : {})}>
      {(field) => <Input {...field} {...form.register(name)} />}
    </FormField>
  );
}

export function AgreementSettingsPage() {
  const [{ data: settings }, { data: roomTypes }] = useSuspenseQueries({
    queries: [agreementSettingsQuery, roomTypesQuery],
  });
  const canManage = useCan()('settings.manage');
  const save = useSaveAgreementSettings();
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    mode: 'onTouched',
    defaultValues: toForm(settings),
  });
  const payment = useFieldArray({ control: form.control, name: 'paymentTerms' });
  const sections = useFieldArray({ control: form.control, name: 'termsSections' });
  const { errors, isDirty, isSubmitting } = useFormState({ control: form.control });
  const [showSummary, setShowSummary] = useState(false);
  const blocker = useBlocker(isDirty && !isSubmitting);

  function handleSubmit(event: SubmitEvent) {
    void form.handleSubmit(
      async (values) => {
        const saved = await save.mutateAsync(fromForm(values));
        form.reset(toForm(saved));
        toast('Agreement settings saved');
      },
      () => {
        setShowSummary(true);
      },
    )(event);
  }

  return (
    <>
      <PageHeader
        title="Agreement"
        action={
          <Link to="/contracts/contract-1/print" className={buttonClass('secondary')}>
            Preview on CON-0001
          </Link>
        }
      />
      <form noValidate onSubmit={handleSubmit} className="space-y-5 p-5 lg:p-8">
        {!canManage && (
          <ErrorNotice title="Read only">
            You need the permission to manage settings to change this.
          </ErrorNotice>
        )}
        {save.error && (
          <ErrorNotice title="This could not be saved">{getErrorMessage(save.error)}</ErrorNotice>
        )}
        {showSummary && <FormErrorSummary form={form} labels={LABELS} />}

        <fieldset disabled={!canManage} className="space-y-5">
          <Card>
            <CardHeader title="Company" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField form={form} name="companyName" label="Company name" />
              <TextField form={form} name="glNumber" label="G.L. No." />
              <TextField form={form} name="ceoName" label="Chief executive" hint="Written as Mr. …" />
              <TextField form={form} name="ceoTitle" label="Title" />
              <TextField form={form} name="signatory" label="Name in the signature" />
              <TextField form={form} name="address" label="Address" />
              <TextField form={form} name="phone" label="Phone" />
              <TextField form={form} name="email" label="Email" />
            </div>
          </Card>

          <Card>
            <CardHeader title="Document" />
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <TextField form={form} name="seasonWord" label="Season word" hint="As in HAJJ 1448 H / 2027" />
              <TextField form={form} name="witness" label="Closing line" />
              <FormField label="Recital" required error={errors.recital?.message} className="sm:col-span-2">
                {(field) => <Textarea {...field} {...form.register('recital')} />}
              </FormField>
              <fieldset className="sm:col-span-2">
                <legend className="text-foreground mb-2 text-sm font-medium">Room short names</legend>
                <div className="grid gap-3 sm:grid-cols-4">
                  {roomTypes.map((type) => (
                    <FormField key={type.id} label={type.name}>
                      {(field) => (
                        <Input
                          {...field}
                          placeholder={type.name.toUpperCase()}
                          {...form.register(`roomTypeShortNames.${type.id}`)}
                        />
                      )}
                    </FormField>
                  ))}
                </div>
              </fieldset>
            </div>
          </Card>

          <Card>
            <CardHeader
              title="2. Terms of payment"
              subtitle="**Words between double asterisks** print bold"
            />
            <ul className="space-y-3 p-5">
              {payment.fields.map((field, index) => (
                <li key={field.id} className="grid items-start gap-3 sm:grid-cols-[12rem_1fr_auto]">
                  <FormField label="In bold" required error={errors.paymentTerms?.[index]?.lead?.message}>
                    {(props) => <Input {...props} {...form.register(`paymentTerms.${index}.lead`)} />}
                  </FormField>
                  <FormField label="Text" required error={errors.paymentTerms?.[index]?.text?.message}>
                    {(props) => <Input {...props} {...form.register(`paymentTerms.${index}.text`)} />}
                  </FormField>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:mt-6"
                    aria-label={`Remove payment term ${String(index + 1)}`}
                    icon={<Trash2 aria-hidden className="size-4" />}
                    onClick={() => {
                      payment.remove(index);
                    }}
                  />
                </li>
              ))}
              <li>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus aria-hidden className="size-4" />}
                  onClick={() => {
                    payment.append({ lead: '', text: '' });
                  }}
                >
                  Add payment term
                </Button>
              </li>
            </ul>
          </Card>

          <Card>
            <CardHeader
              title="3. Terms & conditions"
              subtitle="One bullet per line. **Words between double asterisks** print bold"
            />
            <ul className="space-y-4 p-5">
              {sections.fields.map((field, index) => (
                <li key={field.id} className="rounded-control border-border space-y-3 border p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <FormField
                      label="Heading"
                      required
                      error={errors.termsSections?.[index]?.heading?.message}
                      className="min-w-48 flex-1"
                    >
                      {(props) => <Input {...props} {...form.register(`termsSections.${index}.heading`)} />}
                    </FormField>
                    <div className="mt-6 flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move section ${String(index + 1)} up`}
                        disabled={index === 0}
                        icon={<ArrowUp aria-hidden className="size-4" />}
                        onClick={() => {
                          sections.move(index, index - 1);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Move section ${String(index + 1)} down`}
                        disabled={index === sections.fields.length - 1}
                        icon={<ArrowDown aria-hidden className="size-4" />}
                        onClick={() => {
                          sections.move(index, index + 1);
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Remove section ${String(index + 1)}`}
                        icon={<Trash2 aria-hidden className="size-4" />}
                        onClick={() => {
                          sections.remove(index);
                        }}
                      />
                    </div>
                  </div>
                  <FormField label="Bullets" required error={errors.termsSections?.[index]?.bullets?.message}>
                    {(props) => (
                      <Textarea {...props} rows={4} {...form.register(`termsSections.${index}.bullets`)} />
                    )}
                  </FormField>
                </li>
              ))}
              <li>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Plus aria-hidden className="size-4" />}
                  onClick={() => {
                    sections.append({ heading: '', bullets: '' });
                  }}
                >
                  Add section
                </Button>
              </li>
            </ul>
          </Card>
        </fieldset>

        {canManage && (
          <div className="flex justify-end">
            <Button type="submit" isLoading={isSubmitting} disabled={!isDirty}>
              Save agreement text
            </Button>
          </div>
        )}
        <HistoryCard entity="settings" entityId="agreement" />
      </form>

      <ConfirmDialog
        open={blocker.state === 'blocked'}
        onCancel={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Discard your changes?"
        confirmLabel="Discard"
        tone="danger"
      >
        What you entered in this form has not been saved.
      </ConfirmDialog>
    </>
  );
}
