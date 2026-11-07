import { createColumnHelper } from '@tanstack/react-table';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Button } from '@/components/ui/Button';

import type { Partner } from '../api/partner.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, Partner>();

interface PartnerColumnOptions {
  onEdit: (partner: Partner) => void;
  onSetActive: (partner: Partner, active: boolean) => void;
}

export function partnerColumns({ onEdit, onSetActive }: PartnerColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => <span className="font-medium">{info.getValue()}</span>,
    }),
    columnHelper.accessor((partner) => partner.company ?? '', { id: 'company', header: 'Company' }),
    columnHelper.accessor((partner) => partner.contactPerson ?? '', {
      id: 'contact',
      header: 'Contact person',
      enableSorting: false,
    }),
    columnHelper.accessor((partner) => partner.phone ?? '', {
      id: 'phone',
      header: 'Phone',
      enableSorting: false,
    }),
    columnHelper.accessor((partner) => partner.email ?? '', {
      id: 'email',
      header: 'Email',
      enableSorting: false,
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Actions',
      cell: (info) => {
        const partner = info.row.original;
        return (
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Edit ${partner.name}`}
              onClick={() => {
                onEdit(partner);
              }}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="sm"
              aria-label={`${partner.active ? 'Deactivate' : 'Activate'} ${partner.name}`}
              onClick={() => {
                onSetActive(partner, !partner.active);
              }}
            >
              {partner.active ? 'Deactivate' : 'Activate'}
            </Button>
          </div>
        );
      },
    }),
  ]);
}
