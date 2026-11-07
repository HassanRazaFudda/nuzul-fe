import { useSuspenseQueries, useSuspenseQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router';

import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery, exchangeRatesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { partnerOptionsQuery } from '@/features/partners';
import { conversionRulesQuery, roomTypesQuery } from '@/features/room-types';
import { todayIso } from '@/lib/format/dates';

import {
  contractContextQuery,
  contractDetailQuery,
  useCreateContract,
  useUpdateContract,
} from '../api/contract.queries';
import type { ContractView } from '../api/contract.schemas';
import { toContractInput, type ContractFormValues } from '../components/contract-form.schema';
import { ContractForm } from '../components/ContractForm';

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
  const navigate = useNavigate();
  const [today] = useState(() => todayIso(new Date()));

  async function handleSave(values: ContractFormValues) {
    const input = toContractInput(values);
    const saved = contract
      ? await updateContract.mutateAsync({ id: contract.id, version: contract.version, input })
      : await createContract.mutateAsync(input);
    toast(`${saved.number} saved as draft`);
    await navigate(`/contracts/${saved.id}`);
  }

  return (
    <>
      <PageHeader
        title={contract ? `Edit ${contract.number}` : 'Add contract'}
        subtitle="Drafts never affect the ledger"
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
        onSave={handleSave}
      />
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
