import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { DataList } from '@/components/data-table/DataList';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Select } from '@/components/ui/Select';
import { TabBar } from '@/components/ui/TabBar';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { useCan } from '@/lib/auth/session';
import { createListParams } from '@/lib/router/useListParams';

import { contractListQuery } from '../api/contract.queries';
import {
  CONTRACT_SORT_FIELDS,
  CONTRACT_STATUSES,
  type ContractSortField,
  type ContractStatus,
} from '../api/contract.schemas';
import { contractColumns } from '../components/contract-columns';

const useContractListParams = createListParams({
  sortFields: CONTRACT_SORT_FIELDS,
  defaultSortBy: 'number',
  defaultSortDir: 'desc',
  statuses: CONTRACT_STATUSES,
  defaultStatus: 'confirmed',
});

const HOTEL_PARAM = 'hotel';

const isSortField = (id: string): id is ContractSortField =>
  CONTRACT_SORT_FIELDS.some((field) => field === id);

const EMPTY: Record<ContractStatus, { title: string; hint: string }> = {
  draft: { title: 'No drafts', hint: 'Drafts appear here and never affect the ledger.' },
  confirmed: { title: 'No confirmed contracts', hint: 'Add a contract, then confirm it.' },
  locked: {
    title: 'No locked contracts',
    hint: 'Locked contracts count on the ledger and cannot be changed.',
  },
  cancelled: { title: 'No cancelled contracts', hint: 'Cancelled contracts stay here for history.' },
};

export function ContractsPage() {
  const can = useCan();
  const canManage = can('contract.create');
  const { params, updateParams } = useContractListParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = searchParams.get(HOTEL_PARAM) ?? '';
  const query = useQuery(contractListQuery({ ...params, hotelId }));
  const [{ data: hotels }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, currenciesQuery],
  });

  function handleHotelChange(next: string) {
    setSearchParams(
      (previous) => {
        const updated = new URLSearchParams(previous);
        if (next) updated.set(HOTEL_PARAM, next);
        else updated.delete(HOTEL_PARAM);
        updated.delete('page');
        return updated;
      },
      { replace: true },
    );
  }

  const columns = contractColumns(
    (code) => currencies.find((item) => item.code === code) ?? { symbol: code, decimals: 2 },
  );
  const counts = query.data?.counts;

  return (
    <>
      <PageHeader
        title="Sales contracts"
        subtitle="Rooms sold to agents"
        action={
          canManage && (
            <Link to="/contracts/new" className={buttonClass('primary')}>
              <Plus aria-hidden className="size-4" />
              Add contract
            </Link>
          )
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <TabBar
          label="Contracts by status"
          value={params.status}
          onChange={(status) => {
            updateParams({ status });
          }}
          items={[
            { value: 'draft', label: 'Draft', count: counts?.draft },
            { value: 'confirmed', label: 'Confirmed', count: counts?.confirmed },
            { value: 'locked', label: 'Locked', count: counts?.locked },
            { value: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
          ]}
        />
        <DataList
          caption="Contracts"
          columns={columns}
          getRowId={(contract) => contract.id}
          query={query}
          params={params}
          defaultSortBy="number"
          onParamsChange={updateParams}
          isSortField={isSortField}
          emptyTitle={EMPTY[params.status].title}
          emptyHint={EMPTY[params.status].hint}
          toolbar={
            <Select
              aria-label="Filter by hotel"
              className="w-56"
              value={hotelId}
              onChange={(event) => {
                handleHotelChange(event.target.value);
              }}
            >
              <option value="">All hotels</option>
              {hotels.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </Select>
          }
        />
      </div>
    </>
  );
}
