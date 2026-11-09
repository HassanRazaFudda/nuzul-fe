import { Badge } from '@/components/ui/Badge';

/** A cost with no purchase behind it. Shown as a word, so nobody reads it as zero. */
export function UnknownCost() {
  return (
    <Badge look="text" tone="warning">
      Unknown
    </Badge>
  );
}
