export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict' // optimistic-concurrency version mismatch
  | 'rate_limited'
  | 'server'
  | 'invalid_response' // a stored or returned record does not match its schema
  | 'unknown';

export interface FieldErrorDetail {
  /** Dot-path matching the request payload, e.g. "lines.0.rate". */
  readonly field: string;
  readonly message: string;
}

interface ApiErrorInit {
  kind: ApiErrorKind;
  message: string;
  fieldErrors?: readonly FieldErrorDetail[];
  cause?: unknown;
}

/** The single error type every data call rejects with. */
export class ApiError extends Error {
  override readonly name = 'ApiError';
  readonly kind: ApiErrorKind;
  readonly fieldErrors: readonly FieldErrorDetail[];

  constructor({ kind, message, fieldErrors = [], cause }: ApiErrorInit) {
    super(message, { cause });
    this.kind = kind;
    this.fieldErrors = fieldErrors;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** User-facing copy. Never show raw messages for server failures. */
export function getErrorMessage(error: unknown): string {
  if (!isApiError(error)) return 'Something went wrong. Please try again.';
  switch (error.kind) {
    case 'network':
      return 'Cannot reach the server. Check your connection and try again.';
    case 'timeout':
      return 'The server took too long to respond. Please try again.';
    case 'unauthorized':
      return 'Your session has expired. Please sign in again.';
    case 'forbidden':
      return 'You do not have permission to perform this action.';
    case 'not_found':
      return 'The requested record was not found. It may have been deleted.';
    case 'conflict':
      return 'This record was changed by someone else. Reload to see the latest version.';
    case 'rate_limited':
      return 'Too many requests. Please wait a moment and try again.';
    case 'validation':
      return error.message;
    case 'server':
    case 'invalid_response':
    case 'unknown':
      return 'Something went wrong on our side. Please try again or contact support.';
  }
}
