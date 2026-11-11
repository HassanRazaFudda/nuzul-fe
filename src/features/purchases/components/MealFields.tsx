import { useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Segmented } from '@/components/ui/Choice';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

import { CHARGE_BASES, MEAL_BASES } from '../api/purchase.schemas';
import { CHARGE_BASIS_LABELS, MEAL_BASIS_LABELS } from './meal-labels';
import type { PurchaseFormValues } from './purchase-form.schema';

const ARRANGEMENTS = [
  { value: 'none', label: 'No meals' },
  { value: 'included', label: 'Included in the rate' },
  { value: 'separate', label: 'Bought separately' },
] as const;

export function MealFields({ form }: { form: UseFormReturn<PurchaseFormValues> }) {
  const { errors } = useFormState({ control: form.control });
  const mealPricing = useWatch({ control: form.control, name: 'mealPricing' });

  return (
    <div className="space-y-4">
      <Segmented legend="Meal arrangement" options={ARRANGEMENTS} register={form.register('mealPricing')} />

      {mealPricing === 'separate' && (
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Meal rate" required error={errors.mealRate?.message}>
            {(field) => <Input {...field} inputMode="decimal" {...form.register('mealRate')} />}
          </FormField>
          <FormField label="Charged">
            {(field) => (
              <Select {...field} {...form.register('mealBasis')}>
                {MEAL_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {MEAL_BASIS_LABELS[basis]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Counted on" hint="With guests sold, meals cost nothing until sales are placed">
            {(field) => (
              <Select {...field} {...form.register('chargeBasis')}>
                {CHARGE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {CHARGE_BASIS_LABELS[basis]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </div>
      )}
      {mealPricing === 'included' && (
        <p className="text-muted text-meta">
          The room rate already covers meals, so no meal cost is added and it cannot be split out later.
        </p>
      )}
    </div>
  );
}
