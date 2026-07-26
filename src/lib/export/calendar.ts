import type { Trip, Stop } from "@/lib/types/trip";
import { format, parseISO } from "date-fns";

function escapeIcs(text: string): string {
  return text.replace(/[,;\\]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
}

function toIcsDate(date: string, time: string): string {
  const d = parseISO(date);
  const [h, m] = time.split(":").map(Number);
  d.setHours(h, m, 0, 0);
  return format(d, "yyyyMMdd'T'HHmmss");
}

export function generateIcs(trip: Trip): string {
  const events: string[] = [];

  for (const day of trip.days) {
    for (const stop of day.stops) {
      events.push(buildStopEvent(stop, day.date, trip.destinationName));
    }
    for (const leg of day.travelLegs) {
      const fromStop = day.stops.find((s) => s.id === leg.fromStopId);
      const toStop = day.stops.find((s) => s.id === leg.toStopId);
      if (fromStop && toStop) {
        events.push(buildTravelEvent(fromStop, toStop, day.date, leg.durationMinutes, leg.mode));
      }
    }
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Voyage//Itinerary//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

function buildStopEvent(stop: Stop, date: string, destination: string): string {
  const uid = `${stop.id}@voyage.app`;
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${toIcsDate(date, stop.scheduledStart)}`,
    `DTEND:${toIcsDate(date, stop.scheduledEnd)}`,
    `SUMMARY:${escapeIcs(stop.name)}`,
    `DESCRIPTION:${escapeIcs(stop.notes ?? stop.category)}`,
    `LOCATION:${escapeIcs(destination)}`,
    "END:VEVENT",
  ].join("\r\n");
}

function buildTravelEvent(
  from: Stop,
  to: Stop,
  date: string,
  durationMinutes: number,
  mode: string
): string {
  const uid = `travel-${from.id}-${to.id}@voyage.app`;
  const start = toIcsDate(date, from.scheduledEnd);
  const endDate = parseISO(date);
  const [h, m] = from.scheduledEnd.split(":").map(Number);
  endDate.setHours(h, m + durationMinutes, 0, 0);

  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTART:${start}`,
    `DTEND:${format(endDate, "yyyyMMdd'T'HHmmss")}`,
    `SUMMARY:${escapeIcs(`Travel to ${to.name}`)}`,
    `DESCRIPTION:${escapeIcs(`${mode} · ${durationMinutes} min`)}`,
    "END:VEVENT",
  ].join("\r\n");
}

export function downloadIcs(trip: Trip): void {
  const ics = generateIcs(trip);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${trip.title.replace(/\s+/g, "-").toLowerCase()}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
