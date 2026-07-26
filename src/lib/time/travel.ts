import type { TravelLeg, TravelMode, Mobility } from "@/lib/types/trip";
import type { Stop } from "@/lib/types/trip";

/** Haversine distance in kilometers */
export function distanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const SPEEDS_KMH: Record<TravelMode, number> = {
  walk: 4.5,
  transit: 22,
  drive: 28,
};

/** Cap unrealistic walking; prefer transit/drive for longer hops */
export function chooseTravelMode(
  km: number,
  preferred: TravelMode
): TravelMode {
  const walkMinutes = (km / SPEEDS_KMH.walk) * 60;

  if (preferred === "walk") {
    if (walkMinutes <= 15) return "walk";
    if (km <= 6) return "transit";
    return "drive";
  }

  if (preferred === "transit") {
    if (walkMinutes <= 12) return "walk";
    if (km <= 12) return "transit";
    return "drive";
  }

  // drive preference
  if (walkMinutes <= 10) return "walk";
  return "drive";
}

export function mobilityToPreferredMode(mobility: Mobility): TravelMode {
  if (mobility === "car") return "drive";
  if (mobility === "mixed") return "transit";
  return "walk";
}

export function estimateTravelForLeg(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  preferred: TravelMode
): { durationMinutes: number; distanceMeters: number; mode: TravelMode } {
  // Missing coords → short placeholder, avoid wild 30m walks from (0,0)
  if (
    (!lat1 && !lng1) ||
    (!lat2 && !lng2) ||
    (Math.abs(lat1) < 0.01 && Math.abs(lng1) < 0.01) ||
    (Math.abs(lat2) < 0.01 && Math.abs(lng2) < 0.01)
  ) {
    return { durationMinutes: 8, distanceMeters: 600, mode: "walk" };
  }

  const km = distanceKm(lat1, lng1, lat2, lng2);
  const mode = chooseTravelMode(km, preferred);
  const raw = (km / SPEEDS_KMH[mode]) * 60;

  // City traffic / wait buffers
  const buffer =
    mode === "walk" ? 0 : mode === "transit" ? 6 : 4;
  const durationMinutes = Math.max(
    mode === "walk" ? 3 : 5,
    Math.min(90, Math.round(raw + buffer))
  );

  return {
    durationMinutes,
    distanceMeters: Math.round(km * 1000),
    mode,
  };
}

export function rebuildTravelLegsSmart(
  stops: Stop[],
  mobility: Mobility = "walk"
): TravelLeg[] {
  const preferred = mobilityToPreferredMode(mobility);
  const sorted = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const legs: TravelLeg[] = [];

  for (let i = 0; i < sorted.length - 1; i++) {
    const from = sorted[i];
    const to = sorted[i + 1];
    const est = estimateTravelForLeg(
      from.metadata?.lat ?? 0,
      from.metadata?.lng ?? 0,
      to.metadata?.lat ?? 0,
      to.metadata?.lng ?? 0,
      preferred
    );

    legs.push({
      id: crypto.randomUUID(),
      fromStopId: from.id,
      toStopId: to.id,
      durationMinutes: est.durationMinutes,
      distanceMeters: est.distanceMeters,
      mode: est.mode,
    });
  }

  return legs;
}
