import { useFormState, useWatch, type UseFormReturn } from 'react-hook-form';

import { FormField } from '@/components/form/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { formatDay, type CalendarMonth } from '@/features/calendar';
import type { Stay } from '@/features/inventory';
import type { RoomType } from '@/features/room-types';

import type { AffectedLine } from '../domain/termination';
import type { TerminationFormValues } from './termination-form.schema';

interface DecisionRowProps {
  form: UseFormReturn<TerminationFormValues>;
  line: AffectedLine;
  hotelName: string;
  roomTypes: readonly RoomType[];
  /** Room types this line may draw from instead, the rules allowing. */
  otherSources: readonly RoomType[];
  /** After the current decisions: rooms still without a vendor. */
  uncovered: readonly (Stay & { rooms: number })[];
  months: CalendarMonth[];
}

/** One sale line losing its rooms, and what happens to it. */
export function DecisionRow({
  form,
  line,
  hotelName,
  roomTypes,
  otherSources,
  uncovered,
  months,
}: DecisionRowProps) {
  const { sale, lost } = line;
  const path = `decisions.${sale.id}` as const;
  const { errors } = useFormState({ control: form.control });
  const kind = useWatch({ control: form.control, name: `${path}.kind` });
  const typeName = (id: string) => roomTypes.find((type) => type.id === id)?.name ?? id;
  const range = (stay: Stay) => `${formatDay(stay.checkIn, months)} to ${formatDay(stay.checkOut, months)}`;
  const decisionErrors = errors.decisions?.[sale.id];

  return (
    <li className="space-y-3 px-5 py-4 text-sm">
      <div className="text-foreground">
        <span className="font-medium">{sale.reference}</span>, {hotelName}: {sale.rooms}{' '}
        {typeName(sale.soldAsTypeId)}
        {sale.roomTypeId !== sale.soldAsTypeId && (
          <span className="text-muted"> from {typeName(sale.roomTypeId)}</span>
        )}
        <ul className="text-muted mt-0.5 text-xs">
          {lost.map((block) => (
            <li key={block.checkIn}>
              Loses {block.rooms} {block.rooms === 1 ? 'room' : 'rooms'}, {range(block)}
            </li>
          ))}
        </ul>
      </div>
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <FormField label="Decision" required error={decisionErrors?.kind?.message}>
          {(field) => (
            <Select {...field} {...form.register(`${path}.kind`)}>
              <option value="">Choose</option>
              <option value="resource">Re-source: rooms from another vendor or type</option>
              <option value="cancel">Cancel this line</option>
              <option value="accept">Accept overbooking</option>
            </Select>
          )}
        </FormField>
        {kind === 'resource' && (
          <FormField
            label="Take rooms from"
            required
            error={decisionErrors?.sourceTypeId?.message}
            hint="The system suggests vendors with free rooms, oldest purchase first"
          >
            {(field) => (
              <Select {...field} {...form.register(`${path}.sourceTypeId`)}>
                <option value="">Choose</option>
                <option value={sale.roomTypeId}>Another vendor, {typeName(sale.roomTypeId)}</option>
                {otherSources.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} stock, the whole stay
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        )}
        {(kind === 'cancel' || kind === 'accept') && (
          <FormField label="Reason" required error={decisionErrors?.reason?.message}>
            {(field) => <Input {...field} {...form.register(`${path}.reason`)} />}
          </FormField>
        )}
      </div>
      {kind !== 'cancel' &&
        kind !== '' &&
        (uncovered.length === 0 ? (
          <p className="text-success-strong text-xs">Every room on this line has a vendor.</p>
        ) : (
          <ul className="text-warning-strong text-xs">
            {uncovered.map((block) => (
              <li key={block.checkIn}>
                Still without a vendor: {block.rooms} {block.rooms === 1 ? 'room' : 'rooms'}, {range(block)}
              </li>
            ))}
          </ul>
        ))}
    </li>
  );
}
