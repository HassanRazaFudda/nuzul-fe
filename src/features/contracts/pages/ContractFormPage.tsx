import { useQueryClient, useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { calendarMonthsQuery } from '@/features/calendar';
import { ImpactReviewDialog, type Impact } from '@/features/changes';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { ledgerSourcesQuery } from '@/features/inventory';
import { partnerOptionsQuery } from '@/features/partners';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';
import { useCan } from '@/lib/auth/session';
import { todayIso } from '@/lib/format/dates';

import {
  contractContextQuery,
  contractDetailQuery,
  useCreateContract,
  useUpdateConfirmedContract,
  useUpdateContract,
} from '../api/contract.queries';
import type { ContractInput, ContractView } from '../api/contract.schemas';
import { toContractInput, type ContractFormValues } from '../components/contract-form.schema';
import { ContractForm } from '../components/ContractForm';
import { contractImpact } from '../domain/contract-change';

interface Review {
  input: ContractInput;
  impact: Impact;
  stamp: string;
  /** Settles the form's save, so its state follows the review. */
  done: () => void;
}

function ContractFormScreen({ contract }: { contract: ContractView | null }) {
  const [
    { data: agents },
    { data: hotels },
    { data: roomTypes },
    { data: rules },
    { data: currencies },
    { data: rates },
    { data: months },
    { data: context },
  ] = useSuspenseQueries({
    queries: [
      partnerOptionsQuery('agents'),
      hotelOptionsQuery,
      roomTypesQuery,
      conversionRulesQuery,
      currenciesQuery,
      exchangeRatesQuery,
      calendarMonthsQuery,
      contractContextQuery(contract?.id ?? null),
    ],
  });
  const createContract = useCreateContract();
  const updateContract = useUpdateContract();
  const updateConfirmed = useUpdateConfirmedContract();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const can = useCan();
  const [today] = useState(() => todayIso(new Date()));
  const [review, setReview] = useState<Review | null>(null);
  const isConfirmed = contract?.status === 'confirmed';

  const names = {
    hotelName: (id: string) =>
      hotels.find((hotel) => hotel.id === id)?.name ??
      contract?.hotels.find((entry) => entry.hotelId === id)?.hotelName ??
      id,
    roomTypeName: (id: string) => roomTypes.find((type) => type.id === id)?.name ?? id,
  };

  /** A Confirmed contract is not saved here: the review shows what the change does first. */
  async function openReview(input: ContractInput) {
    if (!contract) return;
    const sources = await queryClient.query(ledgerSourcesQuery);
    const impact = contractImpact(sources, contract, input.hotels);
    await new Promise<void>((resolve) => {
      setReview({ input, impact, stamp: sources.stamp, done: resolve });
    });
  }

  async function handleConfirmReview(reason: string) {
    if (!contract || !review) return;
    const result = await updateConfirmed.mutateAsync({
      id: contract.id,
      version: contract.version,
      input: review.input,
      reason,
      stamp: review.stamp,
    });
    toast(
      result.trimmedRooms > 0
        ? `${contract.number} saved. ${String(result.trimmedRooms)} rooms lost their vendor and are now unallocated.`
        : `${contract.number} saved`,
    );
    await navigate(`/contracts/${contract.id}`);
    review.done();
  }

  function closeReview() {
    review?.done();
    setReview(null);
  }

  async function handleSave(values: ContractFormValues) {
    const input = toContractInput(values);
    if (isConfirmed) {
      await openReview(input);
      return;
    }
    const saved = contract
      ? await updateContract.mutateAsync({ id: contract.id, version: contract.version, input })
      : await createContract.mutateAsync(input);
    toast(`${saved.number} saved as draft`);
    await navigate(`/contracts/${saved.id}`);
  }

  return (
    <>
      <PageHeader
        title={contract ? `Edit ${contract.number}` : 'New sales contract'}
        breadcrumbs={
          contract
            ? [
                { label: 'Sales contracts', to: '/contracts' },
                { label: contract.number, to: `/contracts/${contract.id}` },
              ]
            : [{ label: 'Sales contracts', to: '/contracts' }]
        }
      />
      <ContractForm
        contract={contract}
        agents={agents}
        hotels={hotels}
        roomTypes={[...roomTypes].sort((a, b) => a.capacity - b.capacity)}
        rules={rules}
        currencies={currencies}
        rates={rates}
        months={months}
        context={context}
        today={today}
        cancelTo={contract ? `/contracts/${contract.id}` : '/contracts'}
        {...(isConfirmed ? { submitLabel: 'Review changes' } : {})}
        onSave={handleSave}
      />
      {review && (
        <ImpactReviewDialog
          title={`Save changes to ${contract?.number ?? ''}?`}
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

export function NewContractPage() {
  return <ContractFormScreen contract={null} />;
}

export function EditContractPage() {
  const { id = '' } = useParams();
  const { data: contract } = useSuspenseQuery(contractDetailQuery(id));
  return <ContractFormScreen contract={contract} />;
}
