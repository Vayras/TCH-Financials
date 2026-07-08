// All domain dates are plain 'YYYY-MM-DD' strings (Postgres `date`). Doing
// the calendar math on UTC timestamps keeps it timezone-proof.

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function daysBetween(a: string, b: string): number {
  return Math.round((parseISODate(b).getTime() - parseISODate(a).getTime()) / 86_400_000);
}

export function addDays(iso: string, days: number): string {
  const d = parseISODate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function monthOf(iso: string): number {
  return Number(iso.slice(5, 7));
}

export function yearOf(iso: string): number {
  return Number(iso.slice(0, 4));
}

// First Wednesday on or after the given date — the weekly payment-clearing
// cycle used by the "clear payment" alert.
export function nextWednesdayOnOrAfter(iso: string): string {
  const d = parseISODate(iso);
  const day = d.getUTCDay(); // Sunday = 0 ... Wednesday = 3
  const delta = (3 - day + 7) % 7;
  d.setUTCDate(d.getUTCDate() + delta);
  return isoDate(d);
}

// Clamp to a valid date (Feb 30 -> Feb 28), mirroring the Django fallback.
export function safeDate(year: number, month: number, day: number): string {
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCMonth() !== month - 1) {
    return isoDate(new Date(Date.UTC(year, month - 1, 28)));
  }
  return isoDate(probe);
}
