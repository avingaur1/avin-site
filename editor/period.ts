/**
 * Work dates are stored as one line of text, e.g. "May 2026 – July 2026" or "October 2026 – Present",
 * exactly as before. These helpers turn that into month/year pickers and back.
 */
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export type MonthYear = { month: number; year: number }; // month 0-11
export type Period = { start: MonthYear; end: MonthYear | "present" };

function month(s: string): number {
  const t = s.trim().toLowerCase().slice(0, 3);
  return MONTHS.findIndex((m) => m.toLowerCase().startsWith(t));
}

function side(s: string): { month: number; year?: number } | "present" | null {
  const t = s.trim();
  if (/^(present|now|current|ongoing)$/i.test(t)) return "present";
  const m = t.match(/^([A-Za-z]+)\.?\s*(\d{4})?$/);
  if (!m) return null;
  const mi = month(m[1]);
  if (mi < 0) return null;
  return { month: mi, year: m[2] ? Number(m[2]) : undefined };
}

/** Returns null when the text isn't a simple date range (the editor then shows it as free text). */
export function parsePeriod(text?: string): Period | null {
  if (!text?.trim()) return null;
  const parts = text.split(/\s+[–—-]\s+|\s*[–—]\s*/);
  if (parts.length !== 2) return null;
  const a = side(parts[0]);
  const b = side(parts[1]);
  if (!a || !b || a === "present") return null;
  if (b === "present") {
    if (a.year === undefined) return null;
    return { start: { month: a.month, year: a.year }, end: "present" };
  }
  if (b.year === undefined) return null;
  return { start: { month: a.month, year: a.year ?? b.year }, end: { month: b.month, year: b.year } };
}

export function formatPeriod(p: Period) {
  const f = (d: MonthYear) => `${MONTHS[d.month]} ${d.year}`;
  return `${f(p.start)} – ${p.end === "present" ? "Present" : f(p.end)}`;
}

export function yearOptions() {
  const now = new Date().getFullYear();
  const ys: number[] = [];
  for (let y = now + 2; y >= now - 15; y--) ys.push(y);
  return ys;
}
