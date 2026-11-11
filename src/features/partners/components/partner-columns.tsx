import { createColumnHelper } from '@tanstack/react-table';
import { Mail, Pencil, Phone, Power } from 'lucide-react';

import type { ServerTableFeatures } from '@/components/data-table/data-table-features';
import { Menu } from '@/components/ui/Menu';

import type { Partner, PartnerKind } from '../api/partner.schemas';

const columnHelper = createColumnHelper<ServerTableFeatures, Partner>();

interface PartnerColumnOptions {
  kind: PartnerKind;
  onEdit: (partner: Partner) => void;
  onSetActive: (partner: Partner, active: boolean) => void;
  canManage: boolean;
}

export function partnerColumns({ kind, onEdit, onSetActive, canManage }: PartnerColumnOptions) {
  return columnHelper.columns([
    columnHelper.accessor('name', {
      header: 'Name',
      cell: (info) => {
        const partner = info.row.original;
        const company = partner.company && partner.company !== partner.name ? partner.company : null;
        return (
          <span className="block min-w-0">
            {canManage ? (
              <button
                type="button"
                onClick={() => {
                  onEdit(partner);
                }}
                className="text-foreground text-start font-medium hover:underline"
              >
                {info.getValue()}
              </button>
            ) : (
              <span className="text-foreground font-medium">{info.getValue()}</span>
            )}
            {company && <span className="text-muted block text-xs">{company}</span>}
          </span>
        );
      },
    }),
    columnHelper.accessor((partner) => partner.contactPerson ?? '', {
      id: 'contact',
      header: 'Contact',
      enableSorting: false,
      cell: (info) => {
        const partner = info.row.original;
        if (!partner.contactPerson && !partner.phone) return <span className="text-faint">—</span>;
        return (
          <span className="block">
            <span className="text-foreground block">{partner.contactPerson}</span>
            {partner.phone && (
              <a
                href={`tel:${partner.phone.replace(/\s+/g, '')}`}
                className="text-muted hover:text-foreground inline-flex items-center gap-1 text-xs tabular-nums"
              >
                <Phone aria-hidden className="size-3" />
                {partner.phone}
              </a>
            )}
          </span>
        );
      },
    }),
    columnHelper.accessor((partner) => partner.email ?? '', {
      id: 'email',
      header: 'Email',
      enableSorting: false,
      cell: (info) =>
        info.getValue() ? (
          <a
            href={`mailto:${info.getValue()}`}
            className="text-secondary hover:text-foreground inline-flex items-center gap-1.5"
          >
            <Mail aria-hidden className="text-muted size-3.5" />
            {info.getValue()}
          </a>
        ) : (
          <span className="text-faint">—</span>
        ),
    }),
    columnHelper.display({
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: (info) => {
        const partner = info.row.original;
        return (
          <div className="flex justify-end">
            <Menu
              label={`Actions for ${partner.name}`}
              items={[
                kind === 'agents'
                  ? { label: 'Their contracts', to: `/contracts?search=${encodeURIComponent(partner.name)}` }
                  : { label: 'Their purchases', to: `/purchases?search=${encodeURIComponent(partner.name)}` },
                canManage && {
                  label: 'Edit',
                  icon: <Pencil aria-hidden />,
                  onSelect: () => {
                    onEdit(partner);
                  },
                },
                canManage && {
                  label: partner.active ? 'Deactivate' : 'Activate',
                  icon: <Power aria-hidden />,
                  hint: partner.active ? 'Hidden from new records, kept on old ones' : undefined,
                  ...(partner.active ? { tone: 'danger' as const } : {}),
                  onSelect: () => {
                    onSetActive(partner, !partner.active);
                  },
                },
              ]}
            />
          </div>
        );
      },
    }),
  ]);
}
