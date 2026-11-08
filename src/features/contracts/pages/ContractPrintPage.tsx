import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { Printer } from 'lucide-react';
import { Link, useParams } from 'react-router';

import { Button } from '@/components/ui/Button';
import { buttonClass } from '@/components/ui/buttonStyles';
import { calendarMonthsQuery, formatDay } from '@/features/calendar';
import { currenciesQuery } from '@/features/currencies';
import { roomTypesQuery } from '@/features/room-types';
import { formatIsoDate, nightsBetween } from '@/lib/format/dates';
import { formatMoney } from '@/lib/money/money';

import { contractDetailQuery } from '../api/contract.queries';
import { MEAL_PLAN_LABELS } from '../components/meal-plan-labels';

/**
 * The contract as a document to print or save as PDF. A plain layout for now: the owner's
 * Hotel Accommodation Agreement format replaces it, with the letterhead and terms.
 */
export function ContractPrintPage() {
  const { id = '' } = useParams();
  const { data: contract } = useSuspenseQuery(contractDetailQuery(id));
  const [{ data: months }, { data: roomTypes }, { data: currencies }] = useSuspenseQueries({
    queries: [calendarMonthsQuery, roomTypesQuery, currenciesQuery],
  });
  const format = currencies.find((item) => item.code === contract.currencyCode) ?? {
    symbol: contract.currencyCode,
    decimals: 2,
  };
  const money = (amount: string) => formatMoney(amount, format);
  const typeName = (typeId: string) => roomTypes.find((type) => type.id === typeId)?.name ?? typeId;
  const day = (iso: string) => `${formatDay(iso, months)} (${formatIsoDate(iso)})`;
  const { mealPlan } = contract;

  return (
    <div className="p-5 lg:p-8 print:p-0">
      <title>{`${contract.number} · Nuzul`}</title>
      <div className="mb-5 flex flex-wrap justify-end gap-2 print:hidden">
        <Link to={`/contracts/${id}`} className={buttonClass('secondary')}>
          Back to contract
        </Link>
        <Button
          icon={<Printer aria-hidden className="size-4" />}
          onClick={() => {
            window.print();
          }}
        >
          Print or save as PDF
        </Button>
      </div>

      <article className="bg-surface text-foreground mx-auto max-w-4xl space-y-6 p-8 text-sm print:max-w-none print:p-0">
        <header className="border-border flex flex-wrap items-start justify-between gap-4 border-b pb-4">
          <div className="border-border text-muted rounded-control flex h-20 w-64 items-center justify-center border border-dashed text-xs">
            Company letterhead
          </div>
          <div className="text-end">
            <h1 className="text-lg font-bold">Hotel Accommodation Agreement</h1>
            <p>Contract {contract.number}</p>
            <p>Date {formatIsoDate(contract.date)}</p>
            {contract.status !== 'confirmed' && (
              <p className="text-danger-strong font-semibold uppercase">{contract.status}</p>
            )}
          </div>
        </header>

        <section>
          <h2 className="text-muted text-xs font-semibold uppercase">Agent</h2>
          <p className="text-base font-semibold">{contract.agentName}</p>
        </section>

        <section>
          <h2 className="text-muted mb-2 text-xs font-semibold uppercase">Accommodation</h2>
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Accommodation</caption>
            <thead>
              <tr className="border-border border-b-2 text-start">
                <th scope="col" className="py-2 pe-3 text-start">
                  Hotel
                </th>
                <th scope="col" className="py-2 pe-3 text-start">
                  Stay
                </th>
                <th scope="col" className="py-2 pe-3 text-start">
                  Rooms
                </th>
                <th scope="col" className="py-2 pe-3 text-start">
                  Rate
                </th>
                <th scope="col" className="py-2 text-end">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody>
              {contract.hotels.map((entry, hotelIndex) =>
                entry.lines.map((line, lineIndex) => (
                  <tr
                    key={`${String(hotelIndex)}-${String(lineIndex)}`}
                    className="border-border border-b align-top"
                  >
                    <td className="py-2 pe-3">{lineIndex === 0 ? entry.hotelName : ''}</td>
                    <td className="py-2 pe-3">
                      {lineIndex === 0 &&
                        `${day(entry.checkIn)} to ${day(entry.checkOut)}, ${String(nightsBetween(entry.checkIn, entry.checkOut))} nights`}
                    </td>
                    <td className="py-2 pe-3">
                      {line.rooms} {typeName(line.soldAsTypeId)}, {line.personsPerRoom} persons per room
                    </td>
                    <td className="py-2 pe-3 tabular-nums">
                      {money(line.rate)} {entry.perNight ? 'per night' : 'for the stay'}
                    </td>
                    <td className="py-2 text-end tabular-nums">{money(line.roomAmount.amount)}</td>
                  </tr>
                )),
              )}
            </tbody>
            <tfoot>
              {contract.hotels.map((entry, index) => (
                <tr key={`total-${String(index)}`}>
                  <td colSpan={4} className="py-1 pe-3 text-end">
                    {entry.hotelName} total
                    {entry.mealIncome.amount !== (0).toFixed(format.decimals) ? ', with meals' : ''}
                  </td>
                  <td className="py-1 text-end tabular-nums">{money(entry.total.amount)}</td>
                </tr>
              ))}
              <tr className="border-border border-t-2 font-semibold">
                <td colSpan={4} className="py-2 pe-3 text-end">
                  Grand total
                </td>
                <td className="py-2 text-end tabular-nums">{money(contract.total.amount)}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section>
          <h2 className="text-muted text-xs font-semibold uppercase">Meal plan</h2>
          <p>
            {mealPlan.kind === 'none'
              ? 'No meals'
              : `${MEAL_PLAN_LABELS[mealPlan.kind]}, ${money(mealPlan.rate)} per person per night`}
            {contract.hotels.some((entry) => entry.noMeals) &&
              mealPlan.kind !== 'none' &&
              `. Not at: ${contract.hotels
                .filter((entry) => entry.noMeals)
                .map((entry) => entry.hotelName)
                .join(', ')}`}
          </p>
        </section>

        {contract.notes && (
          <section>
            <h2 className="text-muted text-xs font-semibold uppercase">Notes</h2>
            <p className="whitespace-pre-line">{contract.notes}</p>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          {['Terms of payment', 'Terms and conditions'].map((heading) => (
            <div key={heading}>
              <h2 className="text-muted text-xs font-semibold uppercase">{heading}</h2>
              <div className="border-border text-muted rounded-control mt-1 flex h-20 items-center justify-center border border-dashed text-xs">
                To come with the agreement format
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-10 pt-10 sm:grid-cols-2 print:grid-cols-2">
          {['For the company', `For ${contract.agentName}`].map((party) => (
            <div key={party} className="border-foreground border-t pt-2">
              <p>{party}</p>
              <p className="text-muted text-xs">Authorised Signature</p>
            </div>
          ))}
        </section>
      </article>
    </div>
  );
}
