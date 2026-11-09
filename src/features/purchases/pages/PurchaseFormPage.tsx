import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';

import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { calendarMonthsQuery } from '@/features/calendar';
import { ImpactReviewDialog, type Impact } from '@/features/changes';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { partnerOptionsQuery } from '@/features/partners';
import { roomTypesQuery } from '@/features/room-types';
import { useCan } from '@/lib/auth/session';
import { todayIso } from '@/lib/format/dates';

import {
  purchaseDetailQuery,
  useCreatePurchase,
  useUpdateConfirmedPurchase,
  useUpdatePurchase,
} from '../api/purchase.queries';
import type { PurchaseInput, PurchaseView } from '../api/purchase.schemas';
import { toPurchaseInput, type PurchaseFormValues } from '../components/purchase-form.schema';
import { readPrefill } from '../components/purchase-prefill';
import { PurchaseForm } from '../components/PurchaseForm';
import { purchaseImpact } from '../domain/purchase-change';

interface Review {
  input: PurchaseInput;
  impact: Impact;
  stamp: string;
  /** Settles the form's save, so its state follows the review. */
  done: () => void;
}

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
  const queryClient = useQueryClient();
  const createPurchase = useCreatePurchase();
  const updatePurchase = useUpdatePurchase();
  const updateConfirmed = useUpdateConfirmedPurchase();
  const navigate = useNavigate();
  const can = useCan();
  const [searchParams] = useSearchParams();
  const [today] = useState(() => todayIso(new Date()));
  const [review, setReview] = useState<Review | null>(null);
  const sortedRoomTypes = [...roomTypes].sort((a, b) => a.capacity - b.capacity);
  // Read once: the form takes its starting values when it mounts.
  const [prefill] = useState(() => (purchase ? null : readPrefill(searchParams, hotels, sortedRoomTypes)));
  const isConfirmed = purchase?.status === 'confirmed';

  const names = {
    hotelName: (id: string) =>
      hotels.find((hotel) => hotel.id === id)?.name ?? (id === purchase?.hotelId ? purchase.hotelName : id),
    roomTypeName: (id: string) => roomTypes.find((type) => type.id === id)?.name ?? id,
  };

  /** A Confirmed purchase is not saved here: the review shows what the change does first. */
  async function openReview(input: PurchaseInput) {
    if (!purchase) return;
    // Read fresh, so the preview is of the records as they are now.
    const sources = await queryClient.query(ledgerSourcesQuery);
    const vendorName = vendors.find((vendor) => vendor.id === input.vendorId)?.name ?? purchase.vendorName;
    const impact = purchaseImpact(sources, purchase.id, {
      id: purchase.id,
      number: purchase.number,
      hotelId: input.hotelId,
      vendorId: input.vendorId,
      vendorName,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      lines: input.lines.map(({ roomTypeId, rooms }) => ({ roomTypeId, rooms })),
    });
    await new Promise<void>((resolve) => {
      setReview({ input, impact, stamp: sources.stamp, done: resolve });
    });
  }

  async function handleSave(values: PurchaseFormValues) {
    const input = toPurchaseInput(values);
    if (isConfirmed) {
      await openReview(input);
      return;
    }
    const saved = purchase
      ? await updatePurchase.mutateAsync({ id: purchase.id, version: purchase.version, input })
      : await createPurchase.mutateAsync(input);
    toast(`${saved.number} saved as draft`);
    await navigate(`/purchases/${saved.id}`);
  }

  async function handleConfirmReview(reason: string) {
    if (!purchase || !review) return;
    const saved = await updateConfirmed.mutateAsync({
      id: purchase.id,
      version: purchase.version,
      input: review.input,
      reason,
      stamp: review.stamp,
    });
    toast(`${saved.number} saved`);
    await navigate(`/purchases/${saved.id}`);
    review.done();
  }

  function closeReview() {
    review?.done();
    setReview(null);
  }

  return (
    <>
      <PageHeader title={purchase ? `Edit ${purchase.number}` : 'Add purchase'} />
      <PurchaseForm
        purchase={purchase}
        hotels={hotels}
        vendors={vendors}
        roomTypes={sortedRoomTypes}
        prefill={prefill}
        currencies={currencies}
        rates={rates}
        months={months}
        today={today}
        cancelTo={purchase ? `/purchases/${purchase.id}` : '/purchases'}
        {...(isConfirmed ? { submitLabel: 'Review changes' } : {})}
        onSave={handleSave}
      />
      {review && (
        <ImpactReviewDialog
          title={`Save changes to ${purchase?.number ?? ''}?`}
          impact={review.impact}
          names={names}
          months={months}
          confirmLabel="Save changes"
          canOverride={can('inventory.override_overbooking')}
          onConfirm={handleConfirmReview}
          onCancel={closeReview}
        />
      )}
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
