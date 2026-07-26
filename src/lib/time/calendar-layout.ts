import type { Stop } from "@/lib/types/trip";
import { parseTimeToMinutes } from "@/lib/utils";

/** Taller hours so event tiles fit content without clipping */
export const HOUR_HEIGHT_PX = 120;
export const CALENDAR_GUTTER_PX = 72;
export const MIN_EVENT_HEIGHT_PX = 88;

export interface CalendarWindow {
  startMinutes: number;
  endMinutes: number;
  hours: number[];
  totalHeight: number;
}

export function buildCalendarWindow(
  dayStartTime: string,
  dayEndTime: string,
  stops: Stop[]
): CalendarWindow {
  let start = Math.floor(parseTimeToMinutes(dayStartTime) / 60) * 60;
  let end = Math.ceil(parseTimeToMinutes(dayEndTime) / 60) * 60;

  for (const stop of stops) {
    const s = parseTimeToMinutes(stop.scheduledStart);
    const e = parseTimeToMinutes(stop.scheduledEnd);
    start = Math.min(start, Math.floor(s / 60) * 60);
    end = Math.max(end, Math.ceil(e / 60) * 60);
  }

  // Comfort padding
  start = Math.max(0, start - 60);
  end = Math.min(24 * 60, Math.max(end + 60, start + 4 * 60));

  const hours: number[] = [];
  for (let m = start; m < end; m += 60) hours.push(m);

  return {
    startMinutes: start,
    endMinutes: end,
    hours,
    totalHeight: ((end - start) / 60) * HOUR_HEIGHT_PX,
  };
}

export function minutesToOffset(
  minutes: number,
  windowStart: number
): number {
  return ((minutes - windowStart) / 60) * HOUR_HEIGHT_PX;
}

export function formatHourLabel(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  if (h < 12) return `${h} AM`;
  return `${h - 12} PM`;
}

export function formatTimeRange(start: string, end: string): string {
  const fmt = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const h = hh % 24;
    const suffix = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return mm === 0 ? `${h12} ${suffix}` : `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
  };
  return `${fmt(start)} › ${fmt(end)}`;
}

export interface EventLayout {
  stop: Stop;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/** Stack overlapping events like Google Calendar */
export function layoutDayEvents(
  stops: Stop[],
  window: CalendarWindow
): EventLayout[] {
  const sorted = [...stops].sort(
    (a, b) =>
      parseTimeToMinutes(a.scheduledStart) -
      parseTimeToMinutes(b.scheduledStart)
  );

  type Active = { end: number; col: number; id: string };
  const active: Active[] = [];
  const colById = new Map<string, number>();
  const groupMaxCols = new Map<string, number>();
  let groupIds: string[] = [];
  let groupCols = 0;

  const flushGroup = () => {
    for (const id of groupIds) groupMaxCols.set(id, Math.max(1, groupCols));
    groupIds = [];
    groupCols = 0;
  };

  for (const stop of sorted) {
    const start = parseTimeToMinutes(stop.scheduledStart);
    const end = Math.max(
      start + 15,
      parseTimeToMinutes(stop.scheduledEnd)
    );

    // Drop finished
    for (let i = active.length - 1; i >= 0; i--) {
      if (active[i].end <= start) active.splice(i, 1);
    }
    if (active.length === 0 && groupIds.length > 0) flushGroup();

    const used = new Set(active.map((a) => a.col));
    let col = 0;
    while (used.has(col)) col += 1;

    active.push({ end, col, id: stop.id });
    colById.set(stop.id, col);
    groupIds.push(stop.id);
    groupCols = Math.max(groupCols, col + 1);
  }
  flushGroup();

  return sorted.map((stop) => {
    const start = parseTimeToMinutes(stop.scheduledStart);
    const end = Math.max(
      start + 20,
      parseTimeToMinutes(stop.scheduledEnd)
    );
    const top = minutesToOffset(start, window.startMinutes);
    const height = Math.max(
      MIN_EVENT_HEIGHT_PX,
      minutesToOffset(end, window.startMinutes) - top - 6
    );
    return {
      stop,
      top,
      height,
      col: colById.get(stop.id) ?? 0,
      cols: groupMaxCols.get(stop.id) ?? 1,
    };
  });
}
