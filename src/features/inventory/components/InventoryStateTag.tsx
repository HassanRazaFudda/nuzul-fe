import { Badge } from '@/components/ui/Badge';

import type { NightState } from '../domain/ledger-engine';

interface InventoryStateTagProps {
  state: NightState;
  rooms?: number;
}

/**
 * Inventory state in the words an agent uses: rooms left to sell, sold out, or overbooked.
 * Always words, never colour alone; only a shortage is red.
 */
export function InventoryStateTag({ state, rooms }: InventoryStateTagProps) {
  switch (state) {
    case 'overbooked':
      return <Badge tone="danger">Overbooked{rooms ? ` by ${String(rooms)}` : ''}</Badge>;
    case 'full':
      return <Badge tone="neutral">Sold out</Badge>;
    case 'available':
      return <Badge tone="success">{rooms ? `${String(rooms)} available` : 'Available'}</Badge>;
  }
}
