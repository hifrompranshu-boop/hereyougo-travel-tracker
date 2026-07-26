import type { OpeningHours, Stop } from "@/lib/types/trip";
import { parseTimeToMinutes } from "@/lib/utils";

export type HoursStatus = "open" | "closed" | "opens-later" | "unknown";

function parseGoogleTime(time: string): number {
  const h = parseInt(time.slice(0, 2), 10);
  const m = parseInt(time.slice(2, 4), 10);
  return h * 60 + m;
}

/** Default daytime hours used for mocks / places without hours data */
export function defaultOpeningHours(): OpeningHours {
  return {
    weekdayText: [
      "Monday: 9:00 AM – 9:00 PM",
      "Tuesday: 9:00 AM – 9:00 PM",
      "Wednesday: 9:00 AM – 9:00 PM",
      "Thursday: 9:00 AM – 9:00 PM",
      "Friday: 9:00 AM – 9:00 PM",
      "Saturday: 9:00 AM – 9:00 PM",
      "Sunday: 9:00 AM – 9:00 PM",
    ],
    periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      open: { day, time: "0900" },
      close: { day, time: "2100" },
    })),
  };
}

/**
 * Nightlife-style hours: closed mornings, open evenings.
 * Useful so scheduling can detect opens-later vs closed.
 */
export function eveningOpeningHours(): OpeningHours {
  return {
    weekdayText: [
      "Monday: 5:00 PM – 11:00 PM",
      "Tuesday: 5:00 PM – 11:00 PM",
      "Wednesday: 5:00 PM – 11:00 PM",
      "Thursday: 5:00 PM – 11:00 PM",
      "Friday: 5:00 PM – 12:00 AM",
      "Saturday: 5:00 PM – 12:00 AM",
      "Sunday: 5:00 PM – 11:00 PM",
    ],
    periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      open: { day, time: "1700" },
      close: { day, time: day === 5 || day === 6 ? "0000" : "2300" },
    })),
  };
}

export function getDayPeriods(hours: OpeningHours | undefined, dayOfWeek: number) {
  if (!hours?.periods?.length) return [];
  return hours.periods.filter((p) => p.open.day === dayOfWeek);
}

export function isClosedAllDay(
  hours: OpeningHours | undefined,
  dateStr: string
): boolean {
  if (!hours?.periods?.length) {
    // Fall back to weekday text containing "Closed"
    if (!hours?.weekdayText?.length) return false;
    const date = new Date(dateStr + "T12:00:00");
    const dayName = date.toLocaleDateString("en-US", { weekday: "long" });
    const line = hours.weekdayText.find((t) =>
      t.toLowerCase().startsWith(dayName.toLowerCase())
    );
    return Boolean(line && /closed/i.test(line));
  }
  const date = new Date(dateStr + "T12:00:00");
  return getDayPeriods(hours, date.getDay()).length === 0;
}

export function getOpenWindowMinutes(
  hours: OpeningHours | undefined,
  dateStr: string
): Array<{ open: number; close: number }> {
  if (!hours?.periods?.length) return [];
  const date = new Date(dateStr + "T12:00:00");
  const dayOfWeek = date.getDay();
  return getDayPeriods(hours, dayOfWeek).map((period) => {
    const open = parseGoogleTime(period.open.time);
    let close = period.close ? parseGoogleTime(period.close.time) : open + 24 * 60;
    if (close <= open) close += 24 * 60; // crosses midnight
    return { open, close };
  });
}

export function getHoursStatusAt(
  hours: OpeningHours | undefined,
  dateStr: string,
  timeMinutes: number
): HoursStatus {
  if (!hours?.periods?.length) {
    if (isClosedAllDay(hours, dateStr)) return "closed";
    return "unknown";
  }

  const windows = getOpenWindowMinutes(hours, dateStr);
  if (windows.length === 0) return "closed";

  for (const w of windows) {
    if (timeMinutes >= w.open && timeMinutes < w.close) return "open";
    if (timeMinutes < w.open) return "opens-later";
  }
  return "closed";
}

export function getStopHoursStatus(
  stop: Stop,
  dateStr: string
): HoursStatus {
  return getHoursStatusAt(
    stop.metadata?.openingHours,
    dateStr,
    parseTimeToMinutes(stop.scheduledStart)
  );
}

/** Earliest start time (minutes) when the stop can be visited for `duration` minutes */
export function earliestOpenStart(
  hours: OpeningHours | undefined,
  dateStr: string,
  dayStartMinutes: number,
  durationMinutes: number
): number | null {
  if (!hours?.periods?.length) {
    if (isClosedAllDay(hours, dateStr)) return null;
    return dayStartMinutes; // unknown → allow
  }

  const windows = getOpenWindowMinutes(hours, dateStr);
  if (windows.length === 0) return null;

  for (const w of windows) {
    const start = Math.max(dayStartMinutes, w.open);
    if (start + durationMinutes <= w.close) return start;
  }
  return null;
}

export function formatPriceLevel(level?: number): string | null {
  if (level == null) return null;
  if (level <= 0) return "Free";
  return "$".repeat(Math.min(4, level));
}

export function formatDurationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
