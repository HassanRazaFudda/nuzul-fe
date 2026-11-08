import { useSuspenseQueries } from '@tanstack/react-query';
import { useState } from 'react';

import { EmptyState } from '@/components/feedback/EmptyState';
import { toast } from '@/components/feedback/toast';
import { Card, CardHeader } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';
import { hotelOptionsQuery } from '@/features/hotels';
import { useCan } from '@/lib/auth/session';

import {
  conversionRulesQuery,
  roomTypesQuery,
  useRemoveConversionRule,
  useSaveConversionRule,
} from '../api/room-type.queries';
import { conversionPairs, conversionRuleId, type ConversionPair } from '../domain/conversion';

const ALL_HOTELS = 'all';

/** The system default, and optional per-hotel overrides, for each downward conversion. */
export function ConversionMatrix() {
  const [{ data: types }, { data: hotels }, { data: rules }] = useSuspenseQueries({
    queries: [roomTypesQuery, hotelOptionsQuery, conversionRulesQuery],
  });
  const saveRule = useSaveConversionRule();
  const removeRule = useRemoveConversionRule();
  const [scope, setScope] = useState(ALL_HOTELS);
  const canManage = useCan()('conversion.manage');

  const hotelId = scope === ALL_HOTELS ? null : scope;
  const pairs = conversionPairs(types);
  const ruleFor = (scopeId: string | null, pair: ConversionPair) =>
    rules.find((rule) => rule.id === conversionRuleId(scopeId, pair.source.id, pair.soldAs.id));

  function handleSetRule(pair: ConversionPair, allowed: boolean) {
    saveRule.mutate(
      {
        id: conversionRuleId(hotelId, pair.source.id, pair.soldAs.id),
        hotelId,
        sourceTypeId: pair.source.id,
        soldAsTypeId: pair.soldAs.id,
        allowed,
      },
      {
        onSuccess: () => {
          toast(`${pair.source.name} as ${pair.soldAs.name}: ${allowed ? 'allowed' : 'not allowed'}`);
        },
      },
    );
  }

  function handleFollowDefault(pair: ConversionPair) {
    removeRule.mutate(conversionRuleId(hotelId, pair.source.id, pair.soldAs.id), {
      onSuccess: () => {
        toast(`${pair.source.name} as ${pair.soldAs.name}: following the default`);
      },
    });
  }

  return (
    <Card>
      <CardHeader
        title="Room conversion"
        subtitle="Which purchased rooms may be sold as a smaller type. Off unless switched on."
        action={
          <Select
            aria-label="Applies to"
            value={scope}
            onChange={(event) => {
              setScope(event.target.value);
            }}
            className="w-56"
          >
            <option value={ALL_HOTELS}>All hotels (default)</option>
            {hotels.map((hotel) => (
              <option key={hotel.id} value={hotel.id}>
                {hotel.name}
              </option>
            ))}
          </Select>
        }
      />
      {pairs.length === 0 ? (
        <EmptyState title="Nothing to convert" hint="Conversion needs room types of different sizes." />
      ) : (
        <ul className="divide-border divide-y">
          {pairs.map((pair) => {
            const label = `Sell ${pair.source.name} as ${pair.soldAs.name}`;
            const own = ruleFor(hotelId, pair);
            const isDefaultAllowed = ruleFor(null, pair)?.allowed ?? false;
            return (
              <li
                key={`${pair.source.id}-${pair.soldAs.id}`}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
              >
                <span className="text-foreground text-sm">{label}</span>
                {hotelId === null ? (
                  <label className="text-muted flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-primary size-4"
                      aria-label={label}
                      checked={own?.allowed ?? false}
                      disabled={!canManage}
                      onChange={(event) => {
                        handleSetRule(pair, event.target.checked);
                      }}
                    />
                    {own?.allowed ? 'Allowed' : 'Not allowed'}
                  </label>
                ) : (
                  <Select
                    aria-label={label}
                    className="w-56"
                    disabled={!canManage}
                    value={own ? (own.allowed ? 'yes' : 'no') : 'default'}
                    onChange={(event) => {
                      const { value } = event.target;
                      if (value === 'default') handleFollowDefault(pair);
                      else handleSetRule(pair, value === 'yes');
                    }}
                  >
                    <option value="default">
                      Use default ({isDefaultAllowed ? 'allowed' : 'not allowed'})
                    </option>
                    <option value="yes">Allowed at this hotel</option>
                    <option value="no">Not allowed at this hotel</option>
                  </Select>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="border-border text-muted border-t px-5 py-3 text-xs">
        Allowing a conversion adds no rooms: a converted sale still draws from the purchased type&apos;s real
        balance, and is costed at that type. Only downward conversions are offered, by guests per room.
      </p>
    </Card>
  );
}
