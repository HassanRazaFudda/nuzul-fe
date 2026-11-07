import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, useFormState } from 'react-hook-form';

import { FormDialog } from '@/components/form/FormDialog';
import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';

import type { Partner } from '../api/partner.schemas';
import { partnerFormSchema, type PartnerFormValues } from './partner-form.schema';

const LABELS = { name: 'Name', email: 'Email' };

interface PartnerFormProps {
  partner: Partner | null;
  noun: string;
  onSave: (values: PartnerFormValues) => Promise<void>;
  onClose: () => void;
}

export function PartnerForm({ partner, noun, onSave, onClose }: PartnerFormProps) {
  const form = useForm<PartnerFormValues>({
    resolver: zodResolver(partnerFormSchema),
    mode: 'onTouched',
    defaultValues: {
      name: partner?.name ?? '',
      company: partner?.company ?? '',
      contactPerson: partner?.contactPerson ?? '',
      phone: partner?.phone ?? '',
      email: partner?.email ?? '',
      address: partner?.address ?? '',
    },
  });
  const { errors } = useFormState({ control: form.control });

  return (
    <FormDialog
      form={form}
      labels={LABELS}
      title={partner ? `Edit ${partner.name}` : `Add ${noun}`}
      onClose={onClose}
      onValid={onSave}
    >
      <FormField label="Name" required error={errors.name?.message}>
        {(field) => <Input {...field} {...form.register('name')} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Company">{(field) => <Input {...field} {...form.register('company')} />}</FormField>
        <FormField label="Contact person">
          {(field) => <Input {...field} {...form.register('contactPerson')} />}
        </FormField>
        <FormField label="Phone">
          {(field) => <Input {...field} type="tel" {...form.register('phone')} />}
        </FormField>
        <FormField label="Email" error={errors.email?.message}>
          {(field) => <Input {...field} type="email" {...form.register('email')} />}
        </FormField>
      </div>
      <FormField label="Address">
        {(field) => <Textarea {...field} {...form.register('address')} />}
      </FormField>
    </FormDialog>
  );
}
