import { format } from 'date-fns';

/** Placeholder for a value the API returned as null. */
export const EMPTY = '—';

/**
 * Formats an ISO timestamp for display.
 *
 * Every timestamp in this contract is nullable — a backend is not required to
 * record them — so the null case is the common one rather than an edge case,
 * and an unparseable value is shown as absent rather than as `Invalid Date`.
 */
export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return EMPTY;

  const date = new Date(dateString);

  if (Number.isNaN(date.getTime())) return EMPTY;

  return format(date, 'MMM dd, yyyy HH:mm');
}

/** Copies `value` and reports it, for the several "copy this" buttons here. */
export async function copyToClipboard(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);
}
