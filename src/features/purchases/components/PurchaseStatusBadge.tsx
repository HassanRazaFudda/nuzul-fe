import { Lock } from 'lucide-react';

import { Badge, type BadgeTone } from '@/components/ui/Badge';

import type { PurchaseStatus } from '../api/purchase.schemas';

const STATUS: Record<PurchaseStatus, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  confirmed: { label: 'Confirmed', tone: 'success' },
  locked: { label: 'Locked', tone: 'neutral' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  terminated: { label: 'Terminated', tone: 'warning' },
};

export function PurchaseStatusBadge({ status }: { status: PurchaseStatus }) {
  const { label, tone } = STATUS[status];
  return (
    <Badge tone={tone} {...(status === 'locked' ? { icon: <Lock aria-hidden className="size-3.5" /> } : {})}>
      {label}
    </Badge>
  );
}
