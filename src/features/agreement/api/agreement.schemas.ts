import { z } from 'zod';

const MAX_LINE = 400;
const MAX_TEXT = 2000;

const line = z
  .string()
  .trim()
  .min(1, 'Enter the text')
  .max(MAX_LINE, `Keep it under ${String(MAX_LINE)} characters`);

/**
 * The fixed parts of the Hotel Accommodation Agreement, editable without code. Text between
 * ** pairs prints in bold, as in the owner's format.
 */
export const agreementSettingsSchema = z.object({
  id: z.literal('agreement'),
  companyName: line,
  glNumber: line,
  ceoName: line,
  ceoTitle: line,
  /** The first party as written in the signature block. */
  signatory: line,
  address: line,
  phone: line,
  email: line,
  /** The word before the year, as in "HAJJ 1448 H / 2027". */
  seasonWord: line,
  recital: z.string().trim().min(1, 'Enter the text').max(MAX_TEXT),
  /** Short names for the rooms column, by room type, such as DBL. */
  roomTypeShortNames: z.record(z.string(), z.string().trim().max(12)),
  paymentTerms: z.array(z.object({ lead: line, text: line })).max(20),
  termsSections: z.array(z.object({ heading: line, bullets: z.array(line).max(20) })).max(20),
  witness: line,
});
/** Settings saved before the signature name became its own field. */
export const DEFAULT_SIGNATORY = 'Junaidi Air Travels & Tours (Pvt.) Ltd.';

export const storedAgreementSettingsSchema = agreementSettingsSchema
  .extend({ signatory: line.optional() })
  .transform((settings) => ({ ...settings, signatory: settings.signatory ?? DEFAULT_SIGNATORY }));

export type AgreementSettings = z.infer<typeof agreementSettingsSchema>;
