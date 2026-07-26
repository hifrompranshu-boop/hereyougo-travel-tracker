import type { Mobility, TravelLeg, TravelMode, Trip, TripDay } from "@/lib/types/trip";
import {
  estimateTravelForLeg,
  mobilityToPreferredMode,
} from "@/lib/time/travel";
import {
  assignTimeSlotsRespectingHours,
  rebuildTravelLegs,
} from "@/lib/time/engine";

function modeToApi(mode: TravelMode): "walking" | "transit" | "driving" {
  if (mode === "walk") return "walking";
  if (mode === "transit") return "transit";
  return "driving";
}

async function fetchGoogleLeg(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: TravelMode
): Promise<{ durationMinutes: number; distanceMeters: number } | null> {
  try {
    const res = await fetch("/api/routes/directions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin,
        destination,
        mode: modeToApi(mode),
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof data.durationMinutes !== "number") return null;
    return {
      durationMinutes: data.durationMinutes,
      distanceMeters: data.distanceMeters ?? 0,
    };
  } catch {
    return null;
  }
}

/** Rebuild day travel legs using Google Routes when possible */
export async function refreshDayTravelLegs(
  day: TripDay,
  mobility: Mobility = "walk"
): Promise<TravelLeg[]> {
  const preferred = mobilityToPreferredMode(mobility);
  const sorted = [...day.stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const legs: TravelLeg[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const lat1 = from.metadata?.lat ?? 0;
    const lng1 = from.metadata?.lng ?? 0;
    const lat2 = to.metadata?.lat ?? 0;
    const lng2 = to.metadata?.lng ?? 0;

    const est = estimateTravelForLeg(lat1, lng1, lat2, lng2, preferred);
    let durationMinutes = est.durationMinutes;
    let distanceMeters = est.distanceMeters;
    const mode = est.mode;

    if (lat1 && lng1 && lat2 && lng2) {
      const google = await fetchGoogleLeg(
        { lat: lat1, lng: lng1 },
        { lat: lat2, lng: lng2 },
        mode
      );
      if (google) {
        durationMinutes = google.durationMinutes;
        distanceMeters = google.distanceMeters || distanceMeters;
      }
    }

    legs.push({
      id: crypto.randomUUID(),
      fromStopId: from.id,
      toStopId: to.id,
      durationMinutes,
      distanceMeters,
      mode,
    });
  }

  return legs;
}

export async function refreshTripTravelAfterChange(
  trip: Trip,
  dayIds: string[]
): Promise<Trip> {
  const updated = structuredClone(trip);
  const mobility = updated.preferences.mobility ?? "walk";

  for (const dayId of dayIds) {
    const day = updated.days.find((d) => d.id === dayId);
    if (!day || day.stops.length === 0) continue;

    day.stops = day.stops.map((s, i) => ({ ...s, sortOrder: i }));
    day.travelLegs = await refreshDayTravelLegs(day, mobility);
    day.stops = assignTimeSlotsRespectingHours(
      day.stops,
      day.travelLegs,
      day.date,
      updated.preferences.dayStartTime
    );
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}

/** Sync estimate fallback without network (instant) */
export function rebuildDayTravelLocal(trip: Trip, dayId: string): Trip {
  const updated = structuredClone(trip);
  const day = updated.days.find((d) => d.id === dayId);
  if (!day) return trip;
  day.travelLegs = rebuildTravelLegs(
    day.stops,
    updated.preferences.mobility ?? "walk"
  );
  day.stops = assignTimeSlotsRespectingHours(
    day.stops,
    day.travelLegs,
    day.date,
    updated.preferences.dayStartTime
  );
  return updated;
}
