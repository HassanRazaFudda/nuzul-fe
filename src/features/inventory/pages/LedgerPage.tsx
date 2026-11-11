import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { useSearchParams } from 'react-router';

import { DataList } from '@/components/data-table/DataList';
import { PageHeader } from '@/components/layout/PageHeader';
import { Select } from '@/components/ui/Select';
import { TabBar } from '@/components/ui/TabBar';
import { calendarMonthsQuery } from '@/features/calendar';
import { hotelOptionsQuery } from '@/features/hotels';
import { createListParams } from '@/lib/router/useListParams';

import { overbookedPoolsQuery, poolListQuery } from '../api/ledger.queries';
import { POOL_SORT_FIELDS, POOL_STATE_FILTERS, type PoolSortField } from '../api/ledger.schemas';
import { poolColumns } from '../components/pool-columns';

const usePoolListParams = createListParams({
  sortFields: POOL_SORT_FIELDS,
  defaultSortBy: 'state',
  statuses: POOL_STATE_FILTERS,
  defaultStatus: 'all',
});

const HOTEL_PARAM = 'hotel';

const isSortField = (id: string): id is PoolSortField => POOL_SORT_FIELDS.some((field) => field === id);

export function LedgerPage() {
  const { params, updateParams } = usePoolListParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = searchParams.get(HOTEL_PARAM) ?? '';
  const query = useQuery(poolListQuery({ ...params, hotelId }));
  const overbooked = useQuery(overbookedPoolsQuery).data;
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
      <PageHeader title="Rooms ledger" subtitle="Every hotel and room type, night by night" />
      <div className="space-y-5 px-(--page-gutter) pt-4 pb-10">
        <TabBar
          label="Rooms by state"
          value={params.status}
          onChange={(status) => {
            updateParams({ status });
          }}
          items={[
            { value: 'all', label: 'All' },
            { value: 'overbooked', label: 'Overbooked', count: overbooked, isAttention: true },
            { value: 'available', label: 'Rooms to sell' },
            { value: 'full', label: 'Sold out' },
          ]}
        />
        <DataList
          caption="Rooms ledger"
          columns={poolColumns(months)}
          getRowId={(pool) => pool.id}
          getRowHref={(pool) => `/inventory/${pool.hotelId}/${pool.roomTypeId}`}
          grouping={{
            key: (pool) => pool.hotelId,
            heading: (pools) => (
              <span className="flex items-baseline gap-2">
                {pools[0]?.hotelName}{' '}
                <span className="text-muted text-xs font-normal">
                  {pools.length === 1 ? '1 room type' : `${String(pools.length)} room types`}
                </span>
              </span>
            ),
          }}
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
                className="text-meta h-(--control-height-sm) w-52"
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
            </>
          }
        />
      </div>
    </>
  );
}
