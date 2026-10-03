// Date helpers. All "today" logic uses Cairo time so the demo behaves the same
// for every judge regardless of where the server runs.

export const TIME_ZONE = "Africa/Cairo";

/** Today's date as YYYY-MM-DD in Cairo time. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Current hour (0-23) in Cairo. Used to guess which meal is being logged. */
export function cairoHour(): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", hour12: false }).format(new Date())
  );
}

/** Add n days to a YYYY-MM-DD string (n can be negative). */
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Whole days between two YYYY-MM-DD strings (b - a). */
export function daysBetween(a: string, b: string): number {
  const ms = new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime();
  return Math.round(ms / 86_400_000);
}

export function formatDay(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { ...opts, timeZone: "UTC" });
}

/** "Today", "Tomorrow", "Yesterday" or a short date. */
export function relativeDay(iso: string, today = todayISO()): string {
  const diff = daysBetween(today, iso);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return formatDay(iso);
}

export function timeAgo(ts: string | null | undefined): string {
  if (!ts) return "—";
  const mins = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} d ago`;
}
