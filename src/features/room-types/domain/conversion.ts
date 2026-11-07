/**
 * Room conversion: which purchased room type may be sold as another. Downward
 * only, by capacity: a Quad can be sold as a Double, never the reverse. It decides
 * only what may be chosen; the source pool's real balance still applies.
 */

export interface RoomType {
  id: string;
  name: string;
  /** Guests the room holds. */
  capacity: number;
}

export interface ConversionRule {
  id: string;
  /** Null is the system-wide default; a hotel's rule overrides it. */
  hotelId: string | null;
  sourceTypeId: string;
  soldAsTypeId: string;
  allowed: boolean;
}

export interface ConversionPair {
  source: RoomType;
  soldAs: RoomType;
}

/** Every pair that could be allowed, largest source first. */
export function conversionPairs(types: RoomType[]): ConversionPair[] {
  const sorted = [...types].sort((a, b) => b.capacity - a.capacity);
  return sorted.flatMap((source) =>
    sorted.filter((soldAs) => soldAs.capacity < source.capacity).map((soldAs) => ({ source, soldAs })),
  );
}

export const conversionRuleId = (hotelId: string | null, sourceTypeId: string, soldAsTypeId: string) =>
  `${hotelId ?? 'all'}:${sourceTypeId}:${soldAsTypeId}`;

/**
 * May this hotel sell `sourceId` stock as `soldAsId`? The same type always may.
 * Otherwise the hotel's rule wins, then the system default, then No.
 */
export function isConversionAllowed(
  rules: ConversionRule[],
  types: RoomType[],
  hotelId: string,
  sourceId: string,
  soldAsId: string,
): boolean {
  if (sourceId === soldAsId) return true;
  const source = types.find((type) => type.id === sourceId);
  const soldAs = types.find((type) => type.id === soldAsId);
  if (!source || !soldAs || soldAs.capacity >= source.capacity) return false;
  const find = (scope: string | null) =>
    rules.find((rule) => rule.id === conversionRuleId(scope, sourceId, soldAsId));
  return (find(hotelId) ?? find(null))?.allowed ?? false;
}
