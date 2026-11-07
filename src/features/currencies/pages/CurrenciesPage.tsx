import { useSuspenseQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { todayIso } from '@/lib/format/dates';
import { rateOn } from '@/lib/money/money';

import {
  currenciesQuery,
  exchangeRatesQuery,
  useAddExchangeRate,
  useCreateCurrency,
  useSetCurrencyEnabled,
  useUpdateCurrency,
} from '../api/currency.queries';
import type { CurrencyRecord } from '../api/currency.schemas';
import { currencyColumns } from '../components/currency-columns';
import type { CurrencyFormOutput, RateFormValues } from '../components/currency-form.schema';
import { CurrencyForm } from '../components/CurrencyForm';
import { RateForm } from '../components/RateForm';
import { RateHistoryDialog } from '../components/RateHistoryDialog';

export function CurrenciesPage() {
  const [{ data: currencies }, { data: rates }] = useSuspenseQueries({
    queries: [currenciesQuery, exchangeRatesQuery],
  });
  const createCurrency = useCreateCurrency();
  const updateCurrency = useUpdateCurrency();
  const setEnabled = useSetCurrencyEnabled();
  const addRate = useAddExchangeRate();
  const [editing, setEditing] = useState<CurrencyRecord | 'new' | null>(null);
  const [updatingRate, setUpdatingRate] = useState<CurrencyRecord | null>(null);
  const [history, setHistory] = useState<CurrencyRecord | null>(null);
  const [today] = useState(() => todayIso(new Date()));

  async function handleSave(values: CurrencyFormOutput) {
    const { rateToPkr, ...payload } = values;
    if (editing === 'new' || editing === null) {
      await createCurrency.mutateAsync({ payload, rateToPkr, effectiveFrom: today });
      toast(`${payload.code} added`);
    } else {
      await updateCurrency.mutateAsync({ currency: editing, payload });
      toast(`${payload.code} saved`);
    }
    setEditing(null);
  }

  async function handleAddRate(values: RateFormValues) {
    if (!updatingRate) return;
    await addRate.mutateAsync({ currencyCode: updatingRate.code, ...values });
    toast(`${updatingRate.code} rate added`);
    setUpdatingRate(null);
  }

  const columns = currencyColumns({
    rates,
    today,
    onUpdateRate: setUpdatingRate,
    onShowHistory: setHistory,
    onEdit: setEditing,
    onSetEnabled: (currency, enabled) => {
      setEnabled.mutate(
        { currency, enabled },
        {
          onSuccess: () => {
            toast(`${currency.code} ${enabled ? 'enabled' : 'disabled'}`);
          },
        },
      );
    },
  });

  return (
    <>
      <PageHeader
        title="Currencies"
        subtitle="Rates against PKR. Saved records keep the rate they were saved with."
        action={
          <Button
            icon={<Plus aria-hidden className="size-4" />}
            onClick={() => {
              setEditing('new');
            }}
          >
            Add currency
          </Button>
        }
      />
      <div className="p-5 lg:p-8">
        <Card>
          <DataTable
            caption="Currencies"
            columns={columns}
            data={currencies}
            getRowId={(currency) => currency.code}
            sort={undefined}
            onSortChange={() => undefined}
            emptyState={<EmptyState title="No currencies yet" />}
          />
        </Card>
      </div>

      {editing && (
        <CurrencyForm
          currency={editing === 'new' ? null : editing}
          takenCodes={currencies.map((currency) => currency.code)}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
      {updatingRate && (
        <RateForm
          currency={updatingRate}
          current={rateOn(rates, updatingRate.code, today)}
          today={today}
          onSave={handleAddRate}
          onClose={() => {
            setUpdatingRate(null);
          }}
        />
      )}
      <RateHistoryDialog
        currency={history}
        rates={rates}
        onClose={() => {
          setHistory(null);
        }}
      />
    </>
  );
}
