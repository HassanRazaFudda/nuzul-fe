import { useSuspenseQuery } from '@tanstack/react-query';
import { createColumnHelper } from '@tanstack/react-table';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { useCan } from '@/lib/auth/session';
import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { DataTable } from '@/components/data-table/DataTable';
import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

import { roomTypesQuery, useSaveRoomType } from '../api/room-type.queries';
import { ConversionMatrix } from '../components/ConversionMatrix';
import { RoomTypeForm, type RoomTypeFormValues } from '../components/RoomTypeForm';
import type { RoomType } from '../domain/conversion';

const columnHelper = createColumnHelper<ServerTableFeatures, RoomType>();

function roomTypeColumns(onEdit: (roomType: RoomType) => void) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Room type',
      enableSorting: false,
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor('capacity', {
      enableSorting: false,
      header: () => <span className="block text-end">Guests per room</span>,
      cell: (info) => <span className="block text-end tabular-nums">{info.getValue()}</span>,
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            aria-label={`Edit ${info.row.original.name}`}
            onClick={() => {
              onEdit(info.row.original);
            }}
          >
            Edit
          </Button>
        </div>
      ),
    }),
  ]);
}

export function RoomTypesPage() {
  const can = useCan();
  const canManage = can('conversion.manage');
  const { data: types } = useSuspenseQuery(roomTypesQuery);
  const saveRoomType = useSaveRoomType();
  const [editing, setEditing] = useState<RoomType | 'new' | null>(null);
  const current = editing === 'new' ? null : editing;

  async function handleSave(values: RoomTypeFormValues) {
    await saveRoomType.mutateAsync({ id: current?.id ?? crypto.randomUUID(), ...values });
    setEditing(null);
    toast(current ? `${values.name} saved` : `${values.name} added`);
  }

  return (
    <>
      <PageHeader
        title="Room types"
        action={
          canManage && (
            <Button
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setEditing('new');
              }}
            >
              Add room type
            </Button>
          )
        }
      />
      <div className="space-y-5 p-5 lg:p-8">
        <Card>
          <DataTable
            caption="Room types"
            columns={
              canManage
                ? roomTypeColumns(setEditing)
                : roomTypeColumns(setEditing).filter((column) => column.id !== 'actions')
            }
            data={[...types].sort((a, b) => a.capacity - b.capacity)}
            getRowId={(type) => type.id}
            sort={undefined}
            onSortChange={() => undefined}
            emptyState={<EmptyState title="No room types yet" />}
          />
        </Card>
        <ConversionMatrix />
      </div>
      {editing && (
        <RoomTypeForm
          roomType={current}
          takenNames={types.filter((type) => type.id !== current?.id).map((type) => type.name.toLowerCase())}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
