import type {
  AIGeneratedItinerary,
  Stop,
  Trip,
  TripDay,
  WizardFormData,
} from "@/lib/types/trip";
import { addDays, format, parseISO } from "date-fns";
import { buildPlacePool, stopsPerDayForPace } from "@/lib/ai/pace";
import {
  DEFAULT_BUDGET_BY_TIER,
  partySpendMultiplier,
} from "@/lib/export/budget";
import {
  assignTimeSlotsRespectingHours,
  filterAndScheduleOpenStops,
  rebuildTravelLegs,
} from "@/lib/time/engine";
import { defaultOpeningHours, eveningOpeningHours } from "@/lib/time/hours";
import { optimizeStopOrder } from "@/lib/optimizer/route";

function resolveDefaultBudget(data: Partial<WizardFormData>): number {
  if (typeof data.defaultBudgetPerDay === "number" && data.defaultBudgetPerDay > 0) {
    return data.defaultBudgetPerDay;
  }
  return DEFAULT_BUDGET_BY_TIER[data.budget ?? "mid"] ?? 80;
}

export function createEmptyTrip(data: Partial<WizardFormData>): Trip {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const defaultBudgetPerDay = resolveDefaultBudget(data);
  const adults = data.adults ?? 2;
  const children = data.children ?? 0;
  const pets = data.pets ?? 0;
  const dayBudgetGbp = Math.round(
    defaultBudgetPerDay * partySpendMultiplier(adults, children, pets)
  );
  const party = { adults, children, pets };
  const cities = data.cities?.length
    ? data.cities.map((c) => ({
        id: c.id,
        placeId: c.placeId,
        name: c.name,
        lat: c.lat,
        lng: c.lng,
        arrivalDate: c.arrivalDate,
        arrivalTime: c.arrivalTime,
        numDays: c.numDays,
        transitToNext: c.transitToNext,
      }))
    : undefined;

  const days = cities?.length
    ? createMultiCityDays(id, data, dayBudgetGbp, party)
    : createEmptyDays(
        id,
        data.numDays ?? 3,
        data.startDate ?? format(new Date(), "yyyy-MM-dd"),
        dayBudgetGbp,
        party
      );

  return {
    id,
    title: data.destinationName
      ? data.destinationName.includes("→")
        ? data.destinationName
        : `Trip to ${data.destinationName}`
      : "New Trip",
    destinationPlaceId: data.destinationPlaceId ?? "",
    destinationName: data.destinationName ?? "",
    destinationLat: data.destinationLat,
    destinationLng: data.destinationLng,
    startDate: data.startDate ?? format(new Date(), "yyyy-MM-dd"),
    numDays: days.length,
    status: "draft",
    preferences: {
      pace: data.pace ?? "moderate",
      budget: data.budget ?? "mid",
      defaultBudgetPerDay,
      travelStyles: data.travelStyles ?? [],
      interests: data.interests ?? [],
      mustInclude: data.mustInclude ?? [],
      avoid: data.avoid ?? [],
      freeTextNotes: data.freeTextNotes ?? "",
      dayStartTime: data.dayStartTime ?? "09:00",
      dayEndTime: data.dayEndTime ?? "21:00",
      mobility: data.mobility ?? "walk",
      strictHours: true,
      adults,
      children,
      pets,
    },
    cities,
    days,
    createdAt: now,
    updatedAt: now,
  };
}

function createEmptyDays(
  tripId: string,
  numDays: number,
  startDate: string,
  budgetGbp: number,
  party: { adults: number; children: number; pets: number }
): TripDay[] {
  const start = parseISO(startDate);
  return Array.from({ length: numDays }, (_, i) => {
    const date = addDays(start, i);
    return {
      id: crypto.randomUUID(),
      tripId,
      dayIndex: i,
      date: format(date, "yyyy-MM-dd"),
      label: `Day ${i + 1} · ${format(date, "EEE MMM d")}`,
      stops: [],
      travelLegs: [],
      budgetGbp,
      adults: party.adults,
      children: party.children,
      pets: party.pets,
    };
  });
}

function createMultiCityDays(
  tripId: string,
  data: Partial<WizardFormData>,
  budgetGbp: number,
  party: { adults: number; children: number; pets: number }
): TripDay[] {
  const cities = data.cities ?? [];
  const days: TripDay[] = [];
  let dayIndex = 0;

  cities.forEach((city, cityIdx) => {
    const start = parseISO(city.arrivalDate);
    for (let d = 0; d < city.numDays; d++) {
      const date = addDays(start, d);
      const isArrival = d === 0;
      days.push({
        id: crypto.randomUUID(),
        tripId,
        dayIndex: dayIndex++,
        date: format(date, "yyyy-MM-dd"),
        label: `${city.name.split(",")[0]} · Day ${d + 1} · ${format(date, "EEE MMM d")}`,
        stops: [],
        travelLegs: [],
        budgetGbp,
        adults: party.adults,
        children: party.children,
        pets: party.pets,
        cityId: city.id,
        cityName: city.name,
        isTransitDay: false,
      });
      if (isArrival && city.arrivalTime) {
        // Arrival day still exploring — dayStart handled at schedule time
      }
    }

    // Transit day to next city
    if (cityIdx < cities.length - 1 && city.transitToNext) {
      const t = city.transitToNext;
      const hours = t.type === "booked" ? t.durationHours : t.maxHours;
      if (hours >= 3) {
        const lastExplore = days[days.length - 1];
        const transitDate = addDays(parseISO(lastExplore.date), 0);
        const next = cities[cityIdx + 1];
        days.push({
          id: crypto.randomUUID(),
          tripId,
          dayIndex: dayIndex++,
          date: format(transitDate, "yyyy-MM-dd"),
          label: `Transit · ${city.name.split(",")[0]} → ${next.name.split(",")[0]}`,
          stops: [],
          travelLegs: [],
          budgetGbp: 0,
          adults: party.adults,
          children: party.children,
          pets: party.pets,
          cityId: city.id,
          cityName: `${city.name} → ${next.name}`,
          isTransitDay: true,
        });
      }
    }
  });

  return days.map((d, i) => ({ ...d, dayIndex: i }));
}

export function buildTripFromAI(
  formData: WizardFormData,
  aiItinerary: AIGeneratedItinerary,
  enrichedStops: Map<string, Stop>
): Trip {
  const trip = createEmptyTrip(formData);
  trip.title = aiItinerary.title || trip.title;
  trip.status = "generated";

  const exploringDays = trip.days.filter((d) => !d.isTransitDay);
  const sortedAiDays = [...aiItinerary.days].sort((a, b) => a.dayIndex - b.dayIndex);

  exploringDays.forEach((day, exploreIdx) => {
    const aiDay = sortedAiDays[exploreIdx];
    if (!aiDay) return;

    const cityName = day.cityName || formData.destinationName;
    const dayStart =
      exploreIdx === 0 || day.date === formData.cities?.[0]?.arrivalDate
        ? formData.cities?.find((c) => c.id === day.cityId)?.arrivalTime ||
          formData.dayStartTime
        : formData.dayStartTime;

    const stops: Stop[] = aiDay.stops.map((aiStop, index) => {
      const key = `${aiDay.dayIndex}-${aiStop.name}`;
      const enriched = enrichedStops.get(key);
      if (enriched) return { ...enriched, sortOrder: index, tripDayId: day.id };

      return {
        id: crypto.randomUUID(),
        tripDayId: day.id,
        sortOrder: index,
        placeId: `unverified-${crypto.randomUUID()}`,
        name: aiStop.name,
        category: aiStop.category,
        scheduledStart: "09:00",
        scheduledEnd: "10:00",
        durationMinutes: aiStop.durationMinutes,
        notes: aiStop.notes,
        metadata: { verified: false },
      };
    });

    fillDayStops(day, stops, formData, cityName, dayStart);
  });

  // Transit days: single transfer stop
  for (const day of trip.days.filter((d) => d.isTransitDay)) {
    const hoursMatch = day.label.match(/→/);
    const city = formData.cities?.find((c) => c.id === day.cityId);
    const transit = city?.transitToNext;
    const hours = transit
      ? transit.type === "booked"
        ? transit.durationHours
        : transit.maxHours
      : 6;
    const depart =
      transit?.type === "booked" ? transit.departTime : formData.dayStartTime || "10:00";
    const durationMinutes = Math.round(hours * 60);

    day.stops = [
      {
        id: crypto.randomUUID(),
        tripDayId: day.id,
        sortOrder: 0,
        placeId: `transit-${day.id}`,
        name: hoursMatch ? day.label.replace("Transit · ", "") : "City transit",
        category: "transit",
        scheduledStart: depart,
        scheduledEnd: addMinutesLabel(depart, durationMinutes),
        durationMinutes,
        notes:
          transit?.type === "booked"
            ? `Booked departure ${depart}, ~${hours}h journey`
            : `Flexible transfer, max ${hours}h`,
        userLocked: true,
        metadata: {
          verified: true,
          description: "Inter-city transfer day",
          openingHours: defaultOpeningHours(),
        },
      },
    ];
    day.travelLegs = [];
  }

  const firstStop = trip.days.find((d) => !d.isTransitDay)?.stops[0];
  if (firstStop?.metadata?.photoUrl) {
    trip.coverPhotoUrl = firstStop.metadata.photoUrl;
  }

  return trip;
}

function addMinutesLabel(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + (m || 0) + minutes;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function fillDayStops(
  day: TripDay,
  stops: Stop[],
  formData: WizardFormData,
  cityName: string,
  dayStartTime: string
) {
  const mobility = formData.mobility ?? "walk";
  let working = optimizeStopOrder(stops);
  let legs = rebuildTravelLegs(working, mobility);
  let { stops: openStops, removed } = filterAndScheduleOpenStops(
    working,
    legs,
    day.date,
    dayStartTime
  );

  const target = stopsPerDayForPace(formData.pace);
  if (openStops.length < target) {
    const pool = buildPlacePool(cityName);
    const used = new Set(openStops.map((s) => s.name.toLowerCase()));
    let i = 0;
    while (openStops.length < target && i < pool.length * 2) {
      const place = pool[i % pool.length];
      i++;
      if (used.has(place.name.toLowerCase())) continue;
      used.add(place.name.toLowerCase());
      const evening = /night|lounge|bar|club/i.test(place.category);
      openStops.push({
        id: crypto.randomUUID(),
        tripDayId: day.id,
        sortOrder: openStops.length,
        placeId: `unverified-${crypto.randomUUID()}`,
        name: place.name,
        category: place.category,
        scheduledStart: "09:00",
        scheduledEnd: "10:00",
        durationMinutes: place.durationMinutes,
        metadata: {
          verified: false,
          openingHours: evening ? eveningOpeningHours() : defaultOpeningHours(),
          description: `A ${place.category} stop in ${cityName}.`,
        },
      });
    }
    ({ stops: openStops, removed } = filterAndScheduleOpenStops(
      openStops,
      rebuildTravelLegs(openStops, mobility),
      day.date,
      dayStartTime
    ));
    void removed;
  }

  openStops = ensureDayMealStops(openStops, day.id, cityName);
  legs = rebuildTravelLegs(openStops, mobility);
  day.stops = assignTimeSlotsRespectingHours(
    openStops,
    legs,
    day.date,
    dayStartTime
  );
  day.travelLegs = legs;
}

export function moveStopBetweenDays(
  trip: Trip,
  stopId: string,
  fromDayId: string,
  toDayId: string,
  newIndex: number
): Trip {
  const updated = structuredClone(trip);
  const fromDay = updated.days.find((d) => d.id === fromDayId);
  const toDay = updated.days.find((d) => d.id === toDayId);
  if (!fromDay || !toDay) return trip;

  const stopIdx = fromDay.stops.findIndex((s) => s.id === stopId);
  if (stopIdx === -1) return trip;

  const [stop] = fromDay.stops.splice(stopIdx, 1);
  stop.tripDayId = toDayId;
  toDay.stops.splice(newIndex, 0, stop);

  recalculateDay(updated, fromDay);
  recalculateDay(updated, toDay);

  return updated;
}

export function reorderStopInDay(
  trip: Trip,
  dayId: string,
  stopId: string,
  newIndex: number
): Trip {
  const updated = structuredClone(trip);
  const day = updated.days.find((d) => d.id === dayId);
  if (!day) return trip;

  const oldIndex = day.stops.findIndex((s) => s.id === stopId);
  if (oldIndex === -1) return trip;

  const [stop] = day.stops.splice(oldIndex, 1);
  day.stops.splice(newIndex, 0, stop);

  recalculateDay(updated, day);
  return updated;
}

export function removeStop(trip: Trip, dayId: string, stopId: string): Trip {
  const updated = structuredClone(trip);
  const day = updated.days.find((d) => d.id === dayId);
  if (!day) return trip;

  day.stops = day.stops.filter((s) => s.id !== stopId);
  recalculateDay(updated, day);
  return updated;
}

export function optimizeDay(trip: Trip, dayId: string): Trip {
  const updated = structuredClone(trip);
  const day = updated.days.find((d) => d.id === dayId);
  if (!day) return trip;

  day.stops = optimizeStopOrder(day.stops);
  recalculateDay(updated, day);
  return updated;
}

export function optimizeAllDays(trip: Trip): Trip {
  const updated = structuredClone(trip);
  for (const day of updated.days) {
    day.stops = optimizeStopOrder(day.stops);
    recalculateDay(updated, day);
  }
  return updated;
}

export type PreferenceReplacement = {
  dayIndex: number;
  originalName: string;
  name: string;
  category: string;
  durationMinutes: number;
  placeId?: string;
  metadata?: Stop["metadata"];
};

/** Apply AI preference replacements; skips locked stops */
export function applyPreferenceReplacements(
  trip: Trip,
  replacements: PreferenceReplacement[],
  instruction?: string
): Trip {
  const updated = structuredClone(trip);
  if (instruction?.trim()) {
    const prev = updated.preferences.freeTextNotes?.trim();
    updated.preferences.freeTextNotes = prev
      ? `${prev}\n${instruction.trim()}`
      : instruction.trim();
  }

  const touched = new Set<string>();
  for (const r of replacements) {
    const day = updated.days.find((d) => d.dayIndex === r.dayIndex);
    if (!day || day.isTransitDay) continue;
    const stop = day.stops.find(
      (s) =>
        !s.userLocked &&
        s.name.toLowerCase() === r.originalName.toLowerCase()
    );
    if (!stop) continue;
    stop.name = r.name;
    stop.category = r.category || stop.category;
    stop.durationMinutes = r.durationMinutes || stop.durationMinutes;
    if (r.placeId) stop.placeId = r.placeId;
    if (r.metadata) stop.metadata = { ...stop.metadata, ...r.metadata };
    touched.add(day.id);
  }

  for (const dayId of touched) {
    const day = updated.days.find((d) => d.id === dayId);
    if (day) recalculateDay(updated, day);
  }

  updated.updatedAt = new Date().toISOString();
  return updated;
}

function recalculateDay(trip: Trip, day: TripDay): void {
  day.stops = day.stops.map((s, i) => ({ ...s, sortOrder: i }));
  const mobility = trip.preferences.mobility ?? "walk";
  day.travelLegs = rebuildTravelLegs(day.stops, mobility);
  const { stops: openStops } = filterAndScheduleOpenStops(
    day.stops,
    day.travelLegs,
    day.date,
    trip.preferences.dayStartTime
  );
  day.travelLegs = rebuildTravelLegs(openStops, mobility);
  day.stops = assignTimeSlotsRespectingHours(
    openStops,
    day.travelLegs,
    day.date,
    trip.preferences.dayStartTime
  );
}

export function wizardToFormData(wizard: WizardFormData): WizardFormData {
  return { ...wizard };
}

/** Guarantee lunch + dinner remain on the day after open-hours filtering */
function ensureDayMealStops(
  stops: Stop[],
  dayId: string,
  destination: string
): Stop[] {
  const city = destination.replace(/,.*/, "").trim() || "City";
  const result = [...stops].sort((a, b) => a.sortOrder - b.sortOrder);
  const used = new Set(result.map((s) => s.name.toLowerCase()));
  const meals = result.filter((s) =>
    /restaurant|cafe|market/i.test(s.category)
  );

  const makeMeal = (name: string, notes: string, duration: number): Stop => ({
    id: crypto.randomUUID(),
    tripDayId: dayId,
    sortOrder: 0,
    placeId: `meal-${crypto.randomUUID()}`,
    name,
    category: "restaurant",
    scheduledStart: "12:00",
    scheduledEnd: "13:00",
    durationMinutes: duration,
    notes,
    metadata: {
      verified: false,
      openingHours: defaultOpeningHours(),
      description: `${notes} in ${city}.`,
      lat: result[0]?.metadata?.lat,
      lng: result[0]?.metadata?.lng,
    },
  });

  if (meals.length === 0) {
    const lunchName = uniqueName(`${city} Lunch Spot`, used);
    const dinnerName = uniqueName(`${city} Dinner Spot`, used);
    const lunch = makeMeal(lunchName, "Lunch break", 75);
    const dinner = makeMeal(dinnerName, "Dinner", 90);
    const mid = Math.max(1, Math.floor(result.length / 2));
    result.splice(mid, 0, lunch);
    result.push(dinner);
  } else if (meals.length === 1) {
    const dinnerName = uniqueName(`${city} Dinner Spot`, used);
    result.push(makeMeal(dinnerName, "Dinner", 90));
  }

  return result.map((s, i) => ({ ...s, sortOrder: i }));
}

function uniqueName(base: string, used: Set<string>): string {
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    name = `${base} #${n++}`;
  }
  used.add(name.toLowerCase());
  return name;
}
