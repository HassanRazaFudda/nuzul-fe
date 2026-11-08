import { z } from 'zod';

import { isoDateField, optionalRate, requiredText } from '@/lib/forms/fields';

import type { AffectedLine, Decision } from '../domain/termination';

const MAX_REASON_LENGTH = 500;

const decisionSchema = z.object({
  kind: z.enum(['', 'resource', 'cancel', 'accept']),
  // A field appears only with the decision that needs it, so either may be missing.
  sourceTypeId: z.string().optional(),
  reason: z
    .string()
    .trim()
    .max(MAX_REASON_LENGTH, `Keep it under ${String(MAX_REASON_LENGTH)} characters`)
    .optional(),
});

const baseSchema = z.object({
  terminationDate: isoDateField,
  effectiveDate: isoDateField,
  reason: requiredText('reason for the termination', MAX_REASON_LENGTH),
  penaltyAmount: optionalRate,
  penaltyCurrency: z.string(),
  refundAmount: optionalRate,
  refundCurrency: z.string(),
  /** Keyed by sale line. Lines that are no longer affected are ignored. */
  decisions: z.record(z.string(), decisionSchema),
});
export type TerminationFormValues = z.infer<typeof baseSchema>;
export type DecisionValues = z.infer<typeof decisionSchema>;

interface SchemaContext {
  checkIn: string;
  checkOut: string;
  affectedFor: (effectiveDate: string) => AffectedLine[];
  hasRate: (currencyCode: string) => boolean;
}

export function terminationFormSchema({ checkIn, checkOut, affectedFor, hasRate }: SchemaContext) {
  return baseSchema.superRefine((values, ctx) => {
    if (values.effectiveDate <= checkIn || values.effectiveDate >= checkOut) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveDate'],
        message:
          'Choose a night after check-in and before check-out. To release every night, cancel instead.',
      });
      return;
    }
    for (const [amount, currency, field] of [
      [values.penaltyAmount, values.penaltyCurrency, 'penaltyAmount'],
      [values.refundAmount, values.refundCurrency, 'refundAmount'],
    ] as const) {
      if (amount !== '' && !hasRate(currency)) {
        ctx.addIssue({ code: 'custom', path: [field], message: `${currency} has no rate on that date` });
      }
    }
    for (const { sale } of affectedFor(values.effectiveDate)) {
      const decision = values.decisions[sale.id];
      const path = ['decisions', sale.id];
      if (!decision || decision.kind === '') {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'kind'],
          message: 'Choose what happens to this line',
        });
      } else if (decision.kind === 'resource' && !decision.sourceTypeId) {
        ctx.addIssue({
          code: 'custom',
          path: [...path, 'sourceTypeId'],
          message: 'Choose where the rooms come from',
        });
      } else if (decision.kind !== 'resource' && !decision.reason) {
        ctx.addIssue({ code: 'custom', path: [...path, 'reason'], message: 'Enter the reason' });
      }
    }
  });
}

/** Only finished decisions, in the shape the domain and the transport take. */
export function toDecisions(values: Record<string, DecisionValues | undefined>): Record<string, Decision> {
  const decisions: Record<string, Decision> = {};
  for (const [saleId, value] of Object.entries(values)) {
    if (!value) continue;
    if (value.kind === 'resource' && value.sourceTypeId) {
      decisions[saleId] = { kind: 'resource', sourceTypeId: value.sourceTypeId };
    } else if (value.kind === 'cancel' || value.kind === 'accept') {
      decisions[saleId] = { kind: value.kind, reason: value.reason?.trim() ?? '' };
    }
  }
  return decisions;
}
