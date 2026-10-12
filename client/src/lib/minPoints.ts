/** Highest first-laydown threshold a new table may ask for (the server applies the same cap). */
export const MAX_MIN_POINTS = 100;

/**
 * The threshold typed in the create form, as whole points between 0 and 100. An emptied or
 * unreadable field keeps the last valid value, rather than turning into 0.
 */
export function readMinPoints(text: string, last: number): number {
  if (text.trim() === "") return last;
  const value = Number(text);
  if (!Number.isFinite(value)) return last;
  return Math.min(MAX_MIN_POINTS, Math.max(0, Math.floor(value)));
}
