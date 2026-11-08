import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { z } from 'zod';

import { todayIso } from '@/lib/format/dates';

/**
 * A report's filters, kept in the URL so a report can be shared, reloaded or bookmarked.
 * Defaults are left out of the URL.
 */
export function useReportParams<TSchema extends z.ZodType<Record<string, string>>>(schema: TSchema) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [today] = useState(() => todayIso(new Date()));
  const parsed = schema.parse(Object.fromEntries(searchParams));
  const defaults = schema.parse({});
  const params = {
    ...parsed,
    on: parsed.on === '' || parsed.on === undefined ? today : parsed.on,
  } as z.output<TSchema> & {
    on: string;
  };

  function updateParams(patch: Partial<z.output<TSchema>>) {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [name, value] of Object.entries(patch)) {
          if (value === undefined || value === defaults[name as keyof typeof defaults]) next.delete(name);
          else next.set(name, String(value));
        }
        return next;
      },
      { replace: true },
    );
  }

  return { params, updateParams, today };
}
