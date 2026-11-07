import { CircleHelp, TriangleAlert } from 'lucide-react';

import { Badge } from '@/components/ui/Badge';

import type { LineTags } from '../domain/overbooking';

/** Tags are worked out on every read, so they clear themselves. */
export function ContractTags({ tags }: { tags: LineTags }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.overbooked && (
        <Badge tone="danger" icon={<TriangleAlert aria-hidden className="size-3.5" />}>
          OVERBOOKED
        </Badge>
      )}
      {tags.needsVendor && (
        <Badge tone="warning" icon={<CircleHelp aria-hidden className="size-3.5" />}>
          Needs vendor
        </Badge>
      )}
    </span>
  );
}
