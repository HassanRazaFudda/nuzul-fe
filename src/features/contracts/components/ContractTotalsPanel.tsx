import { useWatch, type Control } from 'react-hook-form';

import type { CurrencyRecord } from '@/features/currencies';
import type { RoomType } from '@/features/room-types';
import { formatMoney, moneyLine } from '@/lib/money/money';

import { contractTotals, type TotalsEntry } from '../domain/contract-totals';
import type { ContractFormValues } from './contract-form.schema';

const NUMBER = /^\d+(\.\d+)?$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const PKR_FORMAT = { symbol: 'PKR', decimals: 2 };

/** While typing, an unfinished figure counts as nothing, so the totals never throw. */
const usableRate = (rate: string | undefined) => (rate && NUMBER.test(rate) ? rate : '0');
const usableCount = (count: number | undefined) =>
  count !== undefined && Number.isInteger(count) && count > 0 ? count : 0;

interface ContractTotalsPanelProps {
  control: Control<ContractFormValues>;
  currencies: readonly CurrencyRecord[];
  roomTypes: readonly RoomType[];
  hotelName: (id: string) => string;
}

/** The live figures beside the form. The saved ones are worked out again on save. */
export function ContractTotalsPanel({ control, currencies, roomTypes, hotelName }: ContractTotalsPanelProps) {
  const values = useWatch({ control });
  const code = values.currencyCode ?? '';
  const format = currencies.find((currency) => currency.code === code) ?? { symbol: code, decimals: 2 };

  const hotels = values.hotels ?? [];
  const entries = hotels.map((entry): TotalsEntry => {
    const { checkIn = '', checkOut = '' } = entry;
    const isUsable = ISO_DATE.test(checkIn) && ISO_DATE.test(checkOut) && checkOut > checkIn;
    return {
      checkIn: isUsable ? checkIn : '2000-01-01',
      checkOut: isUsable ? checkOut : '2000-01-01',
      perNight: entry.perNight ?? true,
      noMeals: entry.noMeals ?? false,
      rateType: entry.rateType ?? 'occupancy',
      doubleRate: usableRate(entry.doubleRate),
      extraBedRate: usableRate(entry.extraBedRate),
      flatRate: usableRate(entry.flatRate),
      lines: (entry.lines ?? []).map((line) => ({
        capacity: roomTypes.find((type) => type.id === line.soldAsTypeId)?.capacity ?? 0,
        rooms: usableCount(line.rooms),
        personsPerRoom: usableCount(line.personsPerRoom),
      })),
    };
  });
  const totals = contractTotals(
    entries,
    values.mealKind === 'none' ? null : usableRate(values.mealRate),
    format.decimals,
  );
  const pkr = moneyLine(totals.total, code, usableRate(values.rateToPkr)).amountPkr;

  return (
    <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-4 pb-4 text-sm">
      {totals.hotels.map((hotel, index) => (
        <div key={index} className="col-span-2 grid grid-cols-subgrid">
          <dt className="text-muted truncate">
            {hotelName(hotels[index]?.hotelId ?? '') || `Hotel ${String(index + 1)}`}
          </dt>
          <dd className="text-foreground text-end tabular-nums">{formatMoney(hotel.total, format)}</dd>
        </div>
      ))}
      <dt className="border-border text-muted border-t pt-2">Rooms</dt>
      <dd className="border-border text-foreground border-t pt-2 text-end tabular-nums">
        {formatMoney(totals.roomAmount, format)}
      </dd>
      <dt className="text-muted">Meals</dt>
      <dd className="text-foreground text-end tabular-nums">{formatMoney(totals.mealIncome, format)}</dd>
      <dt className="border-border text-foreground border-t pt-2 font-semibold">Grand total</dt>
      <dd className="border-border text-foreground border-t pt-2 text-end text-base font-semibold tabular-nums">
        {formatMoney(totals.total, format)}
      </dd>
      <dt className="text-muted">In PKR</dt>
      <dd className="text-muted text-end tabular-nums">{formatMoney(pkr, PKR_FORMAT)}</dd>
    </dl>
  );
}
