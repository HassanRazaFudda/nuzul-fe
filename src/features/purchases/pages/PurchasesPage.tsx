import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';

import { DataList } from '@/components/data-table/DataList';
import { PageHeader } from '@/components/layout/PageHeader';
import { buttonClass } from '@/components/ui/buttonStyles';
import { Select } from '@/components/ui/Select';
import { TabBar } from '@/components/ui/TabBar';
import { calendarMonthsQuery } from '@/features/calendar';
import { currenciesQuery } from '@/features/currencies';
import { hotelOptionsQuery } from '@/features/hotels';
import { createListParams } from '@/lib/router/useListParams';

import { purchaseListQuery } from '../api/purchase.queries';
import {
  PURCHASE_SORT_FIELDS,
  PURCHASE_STATUSES,
  type PurchaseSortField,
  type PurchaseStatus,
} from '../api/purchase.schemas';
import { purchaseColumns } from '../components/purchase-columns';

const usePurchaseListParams = createListParams({
  sortFields: PURCHASE_SORT_FIELDS,
  defaultSortBy: 'number',
  defaultSortDir: 'desc',
  statuses: PURCHASE_STATUSES,
  defaultStatus: 'confirmed',
});

const HOTEL_PARAM = 'hotel';

const isSortField = (id: string): id is PurchaseSortField =>
  PURCHASE_SORT_FIELDS.some((field) => field === id);

const EMPTY: Record<PurchaseStatus, { title: string; hint: string }> = {
  draft: { title: 'No drafts', hint: 'Drafts appear here and never affect the ledger.' },
  confirmed: { title: 'No confirmed purchases', hint: 'Add a purchase, then confirm it.' },
  cancelled: { title: 'No cancelled purchases', hint: 'Cancelled purchases stay here for history.' },
  terminated: {
    title: 'No terminated purchases',
    hint: 'A terminated purchase counts on the ledger only before its effective date.',
  },
};

export function PurchasesPage() {
  const { params, updateParams } = usePurchaseListParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const hotelId = searchParams.get(HOTEL_PARAM) ?? '';
  const query = useQuery(purchaseListQuery({ ...params, hotelId }));
  const [{ data: hotels }, { data: months }, { data: currencies }] = useSuspenseQueries({
    queries: [hotelOptionsQuery, calendarMonthsQuery, currenciesQuery],
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

  const columns = purchaseColumns({
    months,
    moneyFormat: (code) => currencies.find((item) => item.code === code) ?? { symbol: code, decimals: 2 },
  });
  const counts = query.data?.counts;

  return (
    <>
      <PageHeader
        title="Purchases"
        subtitle="Room blocks bought from vendors"
        action={
          <Link to="/purchases/new" className={buttonClass('primary')}>
            <Plus aria-hidden className="size-4" />
            Add purchase
          </Link>
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <TabBar
          label="Purchases by status"
          value={params.status}
          onChange={(status) => {
            updateParams({ status });
          }}
          items={[
            { value: 'draft', label: 'Draft', count: counts?.draft },
            { value: 'confirmed', label: 'Confirmed', count: counts?.confirmed },
            { value: 'cancelled', label: 'Cancelled', count: counts?.cancelled },
            { value: 'terminated', label: 'Terminated', count: counts?.terminated },
          ]}
        />
        <DataList
          caption="Purchases"
          columns={columns}
          getRowId={(purchase) => purchase.id}
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
