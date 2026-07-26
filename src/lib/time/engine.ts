import {
  PACE_MAX_MINUTES,
  type DayTimeStats,
  type Mobility,
  type Pace,
  type Stop,
  type TravelLeg,
  type TripDay,
} from "@/lib/types/trip";
import {
  earliestOpenStart,
  isClosedAllDay,
} from "@/lib/time/hours";
import {
  distanceKm,
  estimateTravelForLeg,
  rebuildTravelLegsSmart,
} from "@/lib/time/travel";
import { addMinutesToTime, parseTimeToMinutes } from "@/lib/utils";

export { getStopHoursStatus } from "@/lib/time/hours";
export { distanceKm, rebuildTravelLegsSmart };

export function computeDayStats(
  day: TripDay,
  pace: Pace
): DayTimeStats {
  const activeMinutes = day.stops.reduce((sum, s) => sum + s.durationMinutes, 0);
  const travelMinutes = day.travelLegs.reduce((sum, l) => sum + l.durationMinutes, 0);
  const totalMinutes = activeMinutes + travelMinutes;
  const maxMinutes = PACE_MAX_MINUTES[pace];

  return {
    activeMinutes,
    travelMinutes,
    totalMinutes,
    isOverpacked: totalMinutes > maxMinutes,
    maxMinutes,
  };
}

export function assignTimeSlots(
  stops: Stop[],
  travelLegs: TravelLeg[],
  dayStartTime: string
): Stop[] {
  if (stops.length === 0) return stops;

  const sorted = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  let cursor = parseTimeToMinutes(dayStartTime);

  return sorted.map((stop, index) => {
    const start = cursor;
    const end = start + stop.durationMinutes;
    cursor = end;

    if (index < sorted.length - 1) {
      const nextStop = sorted[index + 1];
      const leg = travelLegs.find(
        (l) => l.fromStopId === stop.id && l.toStopId === nextStop.id
      );
      if (leg) cursor += leg.durationMinutes;
    }

    return {
      ...stop,
      scheduledStart: minutesToTimeStr(start),
      scheduledEnd: minutesToTimeStr(end),
    };
  });
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Drop places closed all day, and schedule remaining stops only while open.
 */
export function filterAndScheduleOpenStops(
  stops: Stop[],
  travelLegs: TravelLeg[],
  dateStr: string,
  dayStartTime: string
): { stops: Stop[]; removed: Stop[] } {
  const kept: Stop[] = [];
  const removed: Stop[] = [];

  for (const stop of stops) {
    if (isClosedAllDay(stop.metadata?.openingHours, dateStr)) {
      removed.push(stop);
      continue;
    }
    const start = earliestOpenStart(
      stop.metadata?.openingHours,
      dateStr,
      parseTimeToMinutes(dayStartTime),
      stop.durationMinutes
    );
    if (start == null) {
      removed.push(stop);
      continue;
    }
    kept.push(stop);
  }

  const sorted = kept.map((s, i) => ({ ...s, sortOrder: i }));
  // Reuse travel legs between kept stops only after caller rebuilds legs
  const timed = assignTimeSlotsRespectingHours(
    sorted,
    travelLegs,
    dateStr,
    dayStartTime
  );
  return { stops: timed, removed };
}

/** Assign times sequentially, waiting until each venue opens if needed */
export function assignTimeSlotsRespectingHours(
  stops: Stop[],
  travelLegs: TravelLeg[],
  dateStr: string,
  dayStartTime: string
): Stop[] {
  if (stops.length === 0) return stops;

  const sorted = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  let cursor = parseTimeToMinutes(dayStartTime);

  return sorted.map((stop, index) => {
    const openStart = earliestOpenStart(
      stop.metadata?.openingHours,
      dateStr,
      cursor,
      stop.durationMinutes
    );
    const start = openStart ?? cursor;
    const end = start + stop.durationMinutes;
    cursor = end;

    if (index < sorted.length - 1) {
      const nextStop = sorted[index + 1];
      const leg = travelLegs.find(
        (l) => l.fromStopId === stop.id && l.toStopId === nextStop.id
      );
      if (leg) cursor += leg.durationMinutes;
    }

    return {
      ...stop,
      scheduledStart: minutesToTimeStr(start),
      scheduledEnd: minutesToTimeStr(end),
    };
  });
}

export function estimateTravelMinutes(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  mode: "walk" | "transit" | "drive" = "walk"
): number {
  return estimateTravelForLeg(lat1, lng1, lat2, lng2, mode).durationMinutes;
}

/**
 * Rebuild travel legs with auto mode selection (walk/transit/drive)
 * based on distance. Pass mobility preference when available.
 */
export function rebuildTravelLegs(
  stops: Stop[],
  modeOrMobility: "walk" | "transit" | "drive" | Mobility = "walk"
): TravelLeg[] {
  const mobility: Mobility =
    modeOrMobility === "drive"
      ? "car"
      : modeOrMobility === "transit"
        ? "mixed"
        : modeOrMobility === "car" ||
            modeOrMobility === "mixed" ||
            modeOrMobility === "accessible"
          ? modeOrMobility
          : "walk";
  return rebuildTravelLegsSmart(stops, mobility);
}

export { addMinutesToTime };
