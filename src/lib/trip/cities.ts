import { addDays, format, parseISO } from "date-fns";
import type { CityTransitPlan, WizardCity, WizardFormData } from "@/lib/types/trip";

export function defaultTransit(): CityTransitPlan {
  return {
    type: "flexible",
    maxHours: 6,
    departTime: "10:00",
    durationHours: 5,
  };
}

export function emptyCity(partial?: Partial<WizardCity>): WizardCity {
  return {
    id: crypto.randomUUID(),
    placeId: "",
    name: "",
    arrivalDate: format(new Date(), "yyyy-MM-dd"),
    arrivalTime: "10:00",
    numDays: 2,
    ...partial,
  };
}

/** Total calendar days including transit buffer days between cities */
export function totalTripDays(cities: WizardCity[]): number {
  if (cities.length === 0) return 0;
  let total = cities.reduce((n, c) => n + Math.max(1, c.numDays), 0);
  // One transit day between each pair when journey is long enough to need a day slot
  for (let i = 0; i < cities.length - 1; i++) {
    const t = cities[i].transitToNext ?? defaultTransit();
    const hours = t.type === "booked" ? t.durationHours : t.maxHours;
    if (hours >= 3) total += 1;
  }
  return total;
}

export function deriveWizardMeta(cities: WizardCity[]): Pick<
  WizardFormData,
  | "destinationName"
  | "destinationPlaceId"
  | "destinationLat"
  | "destinationLng"
  | "startDate"
  | "numDays"
  | "dayStartTime"
> {
  const first = cities[0];
  const names = cities.map((c) => c.name).filter(Boolean);
  return {
    destinationName: names.length ? names.join(" → ") : "",
    destinationPlaceId: first?.placeId ?? "",
    destinationLat: first?.lat,
    destinationLng: first?.lng,
    startDate: first?.arrivalDate ?? format(new Date(), "yyyy-MM-dd"),
    numDays: Math.max(1, totalTripDays(cities)),
    dayStartTime: first?.arrivalTime ?? "09:00",
  };
}

/**
 * After editing city[i].numDays or transit, nudge following cities' arrival dates
 * so the chain stays consistent (user can still override).
 */
export function cascadeCityDates(cities: WizardCity[]): WizardCity[] {
  if (cities.length === 0) return cities;
  const next = cities.map((c) => ({ ...c, transitToNext: c.transitToNext ? { ...c.transitToNext } : undefined }));

  for (let i = 0; i < next.length - 1; i++) {
    const cur = next[i];
    const transit = cur.transitToNext ?? defaultTransit();
    cur.transitToNext = transit;
    const hours = transit.type === "booked" ? transit.durationHours : transit.maxHours;
    // Arrive next city after stay days (transit on last stay day / following morning)
    const leaveDate = addDays(parseISO(cur.arrivalDate), Math.max(0, cur.numDays - 1));
    let arriveNext = leaveDate;
    if (hours >= 8) {
      arriveNext = addDays(leaveDate, 1);
    }
    next[i + 1] = {
      ...next[i + 1],
      arrivalDate: format(arriveNext, "yyyy-MM-dd"),
      arrivalTime:
        transit.type === "booked"
          ? addHoursToTime(transit.departTime, transit.durationHours)
          : next[i + 1].arrivalTime || "14:00",
    };
  }
  return next;
}

function addHoursToTime(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + Math.round(hours * 60);
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}
