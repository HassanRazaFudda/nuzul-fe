import { Badge } from '@/components/ui/Badge';

import type { LineTags } from '../domain/overbooking';

/** Tags are worked out on every read, so they clear themselves. */
export function ContractTags({ tags }: { tags: LineTags }) {
  return (
    <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
      {tags.overbooked && (
        <Badge look="text" tone="danger">
          Overbooked
        </Badge>
      )}
      {tags.needsVendor && (
        <Badge look="text" tone="warning">
          Needs vendor
        </Badge>
      )}
    </span>
  );
}
