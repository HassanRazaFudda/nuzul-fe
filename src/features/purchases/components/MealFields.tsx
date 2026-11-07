import { useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';

import { CHARGE_BASES, MEAL_BASES } from '../api/purchase.schemas';
import { CHARGE_BASIS_LABELS, MEAL_BASIS_LABELS } from './meal-labels';
import type { PurchaseFormValues } from './purchase-form.schema';

export function MealFields({ form }: { form: UseFormReturn<PurchaseFormValues> }) {
  const { errors } = useFormState({ control: form.control });
  const mealPricing = useWatch({ control: form.control, name: 'mealPricing' });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Meal arrangement" className="sm:col-span-2 sm:max-w-sm">
        {(field) => (
          <Select {...field} {...form.register('mealPricing')}>
            <option value="none">None</option>
            <option value="included">Included in the room rate</option>
            <option value="separate">Purchased separately</option>
          </Select>
        )}
      </FormField>

      {mealPricing === 'separate' && (
        <>
          <FormField label="Meal rate" required error={errors.mealRate?.message}>
            {(field) => <Input {...field} inputMode="decimal" {...form.register('mealRate')} />}
          </FormField>
          <FormField label="Meal rate is">
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
          <FormField
            label="Charge basis"
            className="sm:col-span-2"
            hint="With guests sold, the meal has no cost until sales are placed."
          >
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
        </>
      )}
      {mealPricing === 'included' && (
        <p className="text-muted text-xs sm:col-span-2">
          The room rate already covers meals, so no meal cost is added and it cannot be split out later.
        </p>
      )}
    </div>
  );
}
