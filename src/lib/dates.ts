/**
 * Local-timezone calendar dates as "YYYY-MM-DD" strings. Never derive a
 * calendar date from toISOString() — that's UTC and shifts around midnight.
 */

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

/** Local midnight of a date string. */
export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Monday-start week. */
export function startOfWeek(s: string): string {
  const d = parseDateStr(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDateStr(d);
}

export function startOfMonth(s: string): string {
  const d = parseDateStr(s);
  return toDateStr(new Date(d.getFullYear(), d.getMonth(), 1));
}

/** First day of the month n months away (used for month navigation). */
export function addMonths(s: string, n: number): string {
  const d = parseDateStr(s);
  return toDateStr(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** Monday-start weeks covering the month around `cursor`, incl. spillover days. */
export function monthGrid(cursor: string): string[][] {
  const first = startOfMonth(cursor);
  const monthPrefix = first.slice(0, 7);
  const weeks: string[][] = [];
  let day = startOfWeek(first);
  do {
    const week: string[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  } while (day.slice(0, 7) === monthPrefix);
  return weeks;
}
