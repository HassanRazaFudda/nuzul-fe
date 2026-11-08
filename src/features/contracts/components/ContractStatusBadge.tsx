import { Badge, type BadgeTone } from '@/components/ui/Badge';

import type { ContractStatus } from '../api/contract.schemas';

const STATUS: Record<ContractStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  locked: { label: 'Locked', tone: 'brand' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
};

export function ContractStatusBadge({ status }: { status: ContractStatus }) {
  const { label, tone } = STATUS[status];
  return <Badge tone={tone}>{label}</Badge>;
}
