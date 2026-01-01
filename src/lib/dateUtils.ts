/**
 * Get today's date in YYYY-MM-DD format using local timezone.
 * This ensures a new day starts at 00:00:00 local time, not UTC.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get today's date string in local timezone
 */
export function getTodayLocal(): string {
  return getLocalDateString(new Date());
}
