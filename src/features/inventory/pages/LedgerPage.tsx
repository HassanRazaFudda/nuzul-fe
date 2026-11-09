import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { DataList } from '@/components/data-table/DataList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select } from '@/components/ui/Select';
import { calendarMonthsQuery } from '@/features/calendar';
import { hotelOptionsQuery } from '@/features/hotels';
import { createListParams } from '@/lib/router/useListParams';

import { poolListQuery } from '../api/ledger.queries';
import {
  POOL_SORT_FIELDS,
  POOL_STATE_FILTERS,
  type PoolSortField,
  type PoolStateFilter,
} from '../api/ledger.schemas';
import { poolColumns } from '../components/pool-columns';

const usePoolListParams = createListParams({
  sortFields: POOL_SORT_FIELDS,
  defaultSortBy: 'state',
  statuses: POOL_STATE_FILTERS,
  defaultStatus: 'all',
});

const HOTEL_PARAM = 'hotel';

const isSortField = (id: string): id is PoolSortField => POOL_SORT_FIELDS.some((field) => field === id);
const isStateFilter = (value: string): value is PoolStateFilter =>
  POOL_STATE_FILTERS.some((filter) => filter === value);

export function LedgerPage() {
  const { params, updateParams } = usePoolListParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = searchParams.get(HOTEL_PARAM) ?? '';
  const query = useQuery(poolListQuery({ ...params, hotelId }));
  const [{ data: hotels }, { data: months }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, calendarMonthsQuery],
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

  return (
    <>
      <PageHeader title="Rooms ledger" />
      <div className="p-5 lg:p-8">
        <DataList
          caption="Rooms ledger"
          columns={poolColumns(months)}
          getRowId={(pool) => pool.id}
          query={query}
          params={params}
          defaultSortBy="state"
          onParamsChange={updateParams}
          isSortField={isSortField}
          emptyTitle="Nothing on the ledger here"
          emptyHint="Only confirmed purchases and sales count"
          toolbar={
            <>
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
              <Select
                aria-label="Filter by state"
                className="w-44"
                value={params.status}
                onChange={(event) => {
                  const { value } = event.target;
                  if (isStateFilter(value)) updateParams({ status: value });
                }}
              >
                <option value="all">All states</option>
                <option value="overbooked">Overbooked</option>
                <option value="full">Fully utilised</option>
                <option value="available">Available</option>
              </Select>
            </>
          }
        />
      </div>
    </>
  );
}
