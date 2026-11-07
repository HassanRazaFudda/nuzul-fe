import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { partnerOptionsQuery } from '@/features/partners';
import { roomTypesQuery } from '@/features/room-types';
import { todayIso } from '@/lib/format/dates';

import { purchaseDetailQuery, useCreatePurchase, useUpdatePurchase } from '../api/purchase.queries';
import type { PurchaseView } from '../api/purchase.schemas';
import { toPurchaseInput, type PurchaseFormValues } from '../components/purchase-form.schema';
import { PurchaseForm } from '../components/PurchaseForm';

function PurchaseFormScreen({ purchase }: { purchase: PurchaseView | null }) {
  const [
    { data: hotels },
    { data: vendors },
    { data: roomTypes },
    { data: currencies },
    { data: rates },
    { data: months },
  ] = useSuspenseQueries({
    queries: [
      hotelOptionsQuery,
      partnerOptionsQuery('vendors'),
      roomTypesQuery,
      currenciesQuery,
      exchangeRatesQuery,
      calendarMonthsQuery,
    ],
  });
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const navigate = useNavigate();
  const [today] = useState(() => todayIso(new Date()));

  async function handleSave(values: PurchaseFormValues) {
    const input = toPurchaseInput(values);
    const saved = purchase
      ? await updatePurchase.mutateAsync({ id: purchase.id, version: purchase.version, input })
      : await createPurchase.mutateAsync(input);
    toast(`${saved.number} saved as draft`);
    await navigate(`/purchases/${saved.id}`);
  }

  return (
    <>
      <PageHeader
        title={purchase ? `Edit ${purchase.number}` : 'Add purchase'}
        subtitle="Drafts never affect the ledger"
      />
      <PurchaseForm
        purchase={purchase}
        hotels={hotels}
        vendors={vendors}
        roomTypes={[...roomTypes].sort((a, b) => a.capacity - b.capacity)}
        currencies={currencies}
        rates={rates}
        months={months}
        today={today}
        cancelTo={purchase ? `/purchases/${purchase.id}` : '/purchases'}
        onSave={handleSave}
      />
    </>
  );
}

export function NewPurchasePage() {
  return <PurchaseFormScreen purchase={null} />;
}

export function EditPurchasePage() {
  const { id = '' } = useParams();
  const { data: purchase } = useSuspenseQuery(purchaseDetailQuery(id));
  return <PurchaseFormScreen purchase={purchase} />;
}
