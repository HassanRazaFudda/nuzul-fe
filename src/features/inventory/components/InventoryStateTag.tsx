import { CheckCircle2, CircleSlash, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';

import type { NightState } from '../domain/ledger-engine';

const ICON_CLASS = 'size-3.5';

interface InventoryStateTagProps {
  state: NightState;
  rooms?: number;
}

/** Inventory state: always an icon and words, never colour alone. */
export function InventoryStateTag({ state, rooms }: InventoryStateTagProps) {
  switch (state) {
    case 'overbooked':
      return (
        <Badge tone="danger" icon={<TriangleAlert aria-hidden className={ICON_CLASS} />}>
          Overbooked{rooms ? ` by ${rooms}` : ''}
        </Badge>
      );
    case 'full':
      return (
        <Badge tone="warning" icon={<CircleSlash aria-hidden className={ICON_CLASS} />}>
          Fully utilised
        </Badge>
      );
    case 'available':
      return (
        <Badge tone="success" icon={<CheckCircle2 aria-hidden className={ICON_CLASS} />}>
          Available{rooms ? `: ${rooms}` : ''}
        </Badge>
      );
  }
}
