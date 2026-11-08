import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { useState } from 'react';

import { DataList } from '@/components/data-table/DataList';
import { toast } from '@/components/feedback/toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { TabBar } from '@/components/ui/TabBar';
import { useCan } from '@/lib/auth/session';
import { createListParams } from '@/lib/router/useListParams';

import { partnerListQuery, useSavePartner, useSetPartnerActive } from '../api/partner.queries';
import {
  ACTIVE_VIEWS,
  PARTNER_SORT_FIELDS,
  type Partner,
  type PartnerKind,
  type PartnerSortField,
} from '../api/partner.schemas';
import { partnerColumns } from './partner-columns';
import type { PartnerFormValues } from './partner-form.schema';
import { PartnerForm } from './PartnerForm';

const usePartnerListParams = createListParams({
  sortFields: PARTNER_SORT_FIELDS,
  defaultSortBy: 'name',
  statuses: ACTIVE_VIEWS,
  defaultStatus: 'active',
});

const isSortField = (id: string): id is PartnerSortField => PARTNER_SORT_FIELDS.some((field) => field === id);

interface PartnersListProps {
  kind: PartnerKind;
  title: string;
  subtitle: string;
  noun: string;
}

/** Vendors and agents are the same screen, on the buying and the selling side. */
export function PartnersList({ kind, title, subtitle, noun }: PartnersListProps) {
  const can = useCan();
  const canManage = can('directory.manage');
  const { params, updateParams } = usePartnerListParams();
  const query = useQuery(partnerListQuery(kind, params));
  const savePartner = useSavePartner(kind);
  const setPartnerActive = useSetPartnerActive(kind);
  const [editing, setEditing] = useState<Partner | 'new' | null>(null);
  const current = editing === 'new' ? null : editing;

  async function handleSave(values: PartnerFormValues) {
    await savePartner.mutateAsync({ partner: current, payload: values });
    setEditing(null);
    toast(current ? `${values.name} saved` : `${values.name} added`);
  }

  const columns = partnerColumns({
    onEdit: setEditing,
    onSetActive: (partner, active) => {
      setPartnerActive.mutate(
        { partner, active },
        {
          onSuccess: () => {
            toast(`${partner.name} ${active ? 'activated' : 'deactivated'}`);
          },
        },
      );
    },
  });
  const lowerTitle = title.toLowerCase();

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          canManage && (
            <Button
              icon={<Plus aria-hidden className="size-4" />}
              onClick={() => {
                setEditing('new');
              }}
            >
              Add {noun}
            </Button>
          )
        }
      />
      <div className="space-y-4 p-5 lg:p-8">
        <TabBar
          label={`${title} by status`}
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
          caption={title}
          columns={canManage ? columns : columns.filter((column) => column.id !== 'actions')}
          getRowId={(partner) => partner.id}
          query={query}
          params={params}
          defaultSortBy="name"
          onParamsChange={updateParams}
          isSortField={isSortField}
          emptyTitle={params.status === 'active' ? `No active ${lowerTitle}` : `No inactive ${lowerTitle}`}
          emptyHint={
            params.status === 'active'
              ? `Add a ${noun} to start.`
              : 'Deactivating keeps history and hides the name from new records.'
          }
        />
      </div>
      {editing && (
        <PartnerForm
          partner={current}
          noun={noun}
          onSave={handleSave}
          onClose={() => {
            setEditing(null);
          }}
        />
      )}
    </>
  );
}
