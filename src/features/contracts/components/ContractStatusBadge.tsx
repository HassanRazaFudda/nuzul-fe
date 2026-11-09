import { Lock } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';

import type { ContractStatus } from '../api/contract.schemas';

const STATUS: Record<ContractStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  locked: { label: 'Locked', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <Badge tone={tone} {...(status === 'locked' ? { icon: <Lock aria-hidden className="size-3.5" /> } : {})}>
      {label}
    </Badge>
  );
}
