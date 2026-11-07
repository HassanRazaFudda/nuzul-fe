import { CircleHelp } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';

/** A cost with no purchase behind it. Shown as a word, so nobody reads it as zero. */
export function UnknownCost() {
  return (
    <Badge tone="danger" icon={<CircleHelp aria-hidden className="size-3.5" />}>
      Unknown
    </Badge>
  );
}
