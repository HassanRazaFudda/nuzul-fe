import { Badge } from '@/components/ui/Badge';

import type { NightState } from '../domain/ledger-engine';

interface InventoryStateTagProps {
  state: NightState;
  rooms?: number;
}

/** Inventory state: always words, never colour alone. Only a shortage asks for a look. */
export function InventoryStateTag({ state, rooms }: InventoryStateTagProps) {
  switch (state) {
    case 'overbooked':
      return (
        <Badge look="text" tone="danger">
          Overbooked{rooms ? ` by ${rooms}` : ''}
        </Badge>
      );
    case 'full':
      return <Badge tone="warning">Fully utilised</Badge>;
    case 'available':
      return <Badge tone="success">Available{rooms ? `: ${rooms}` : ''}</Badge>;
  }
}
