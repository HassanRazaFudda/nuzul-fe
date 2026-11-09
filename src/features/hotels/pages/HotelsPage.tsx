import { useQuery, useSuspenseQueries } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DataList } from '@/components/data-table/DataList';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { TabBar } from '@/components/ui/TabBar';
import { currenciesQuery } from '@/features/currencies';
import { useCan } from '@/lib/auth/session';
import { createListParams } from '@/lib/router/useListParams';

import { cityOptionsQuery, hotelListQuery, useSaveHotel, useSetHotelActive } from '../api/hotel.queries';
import { ACTIVE_VIEWS, HOTEL_SORT_FIELDS, type Hotel, type HotelSortField } from '../api/hotel.schemas';
import { hotelColumns } from '../components/hotel-columns';
import type { HotelFormValues } from '../components/hotel-form.schema';
import { HotelForm } from '../components/HotelForm';

const useHotelListParams = createListParams({
  sortFields: HOTEL_SORT_FIELDS,
  defaultSortBy: 'name',
  statuses: ACTIVE_VIEWS,
  defaultStatus: 'active',
});

const isSortField = (id: string): id is HotelSortField => HOTEL_SORT_FIELDS.some((field) => field === id);

export function HotelsPage() {
  const can = useCan();
  const canManage = can('directory.manage');
  const { params, updateParams } = useHotelListParams();
  const query = useQuery(hotelListQuery(params));
  // Loaded by the page, not the form, so opening the form never suspends the page.
  const [{ data: cities }, { data: currencies }] = useSuspenseQueries({
    queries: [cityOptionsQuery, currenciesQuery],
  });
  const saveHotel = useSaveHotel();
  const setHotelActive = useSetHotelActive();
  const [editing, setEditing] = useState<Hotel | 'new' | null>(null);
  const current = editing === 'new' ? null : editing;

  async function handleSave(values: HotelFormValues) {
    await saveHotel.mutateAsync({ hotel: current, payload: values });
    setEditing(null);
    toast(current ? `${values.name} saved` : `${values.name} added`);
  }

  const columns = hotelColumns({
    currencies,
    onEdit: setEditing,
    onSetActive: (hotel, active) => {
      setHotelActive.mutate(
        { hotel, active },
        {
          onSuccess: () => {
            toast(`${hotel.name} ${active ? 'activated' : 'deactivated'}`);
          },
        },
      );
    },
  });

  return (
    <>
      <PageHeader
        title="Hotels"
        action={
          canManage && (
            <Button
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setEditing('new');
              }}
            >
              Add hotel
            </Button>
          )
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <TabBar
          label="Hotels by status"
          value={params.status}
          onChange={(status) => {
            updateParams({ status });
          }}
          items={[
            { value: 'active', label: 'Active', count: query.data?.counts.active },
            { value: 'inactive', label: 'Inactive', count: query.data?.counts.inactive },
          ]}
        />
        <DataList
          caption="Hotels"
          columns={canManage ? columns : columns.filter((column) => column.id !== 'actions')}
          getRowId={(hotel) => hotel.id}
          query={query}
          params={params}
          defaultSortBy="name"
          onParamsChange={updateParams}
          isSortField={isSortField}
          emptyTitle={params.status === 'active' ? 'No active hotels' : 'No inactive hotels'}
          {...(params.status === 'active' ? { emptyHint: 'Add a hotel to start' } : {})}
        />
      </div>
      {editing && (
        <HotelForm
          hotel={current}
          cities={cities}
          currencies={currencies}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
