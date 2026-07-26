import {
  costGbpFromPriceLevel,
  estimateDaySpendGbp,
  estimateStopCostGbp,
  maxPriceLevelForCost,
} from "@/lib/export/budget";
import {
  assignTimeSlotsRespectingHours,
  rebuildTravelLegs,
} from "@/lib/time/engine";
import type { Stop, Trip, TripDay } from "@/lib/types/trip";

type AltCandidate = {
  name: string;
  category: string;
  durationMinutes: number;
  placeId?: string;
  metadata?: Stop["metadata"];
};

function altCostGbp(alt: AltCandidate): number {
  if (alt.metadata?.estimatedCostGbp != null) return alt.metadata.estimatedCostGbp;
  return costGbpFromPriceLevel(alt.metadata?.priceLevel);
}

/**
 * Swap the most expensive unlocked stops for cheaper alternatives until
 * the day is within budgetGbp (or no more candidates remain).
 */
export async function adjustDayToBudget(
  trip: Trip,
  dayId: string,
  budgetGbp: number
): Promise<{ trip: Trip; swapped: number }> {
  const updated = structuredClone(trip);
  const day = updated.days.find((d) => d.id === dayId);
  if (!day || day.isTransitDay) {
    if (day) day.budgetGbp = budgetGbp;
    return { trip: updated, swapped: 0 };
  }

  day.budgetGbp = budgetGbp;
  let swapped = 0;
  const maxPasses = Math.min(day.stops.length, 4);
  const tried = new Set<string>();

  for (let pass = 0; pass < maxPasses; pass++) {
    const spend = estimateDaySpendGbp(day, updated.preferences);
    if (spend <= budgetGbp) break;

    const candidate = pickMostExpensiveUnlocked(day, tried);
    if (!candidate) break;
    tried.add(candidate.id);

    const remaining = budgetGbp - (spend - estimateStopCostGbp(candidate));
    const maxLevel = maxPriceLevelForCost(Math.max(0, remaining));

    const alt = await fetchCheaperAlternative(
      trip,
      candidate,
      maxLevel,
      Math.max(0, remaining)
    );
    if (!alt) continue;

    const idx = day.stops.findIndex((s) => s.id === candidate.id);
    if (idx < 0) continue;

    day.stops[idx] = {
      ...candidate,
      name: alt.name,
      category: alt.category || candidate.category,
      placeId: alt.placeId || candidate.placeId,
      durationMinutes: alt.durationMinutes || candidate.durationMinutes,
      metadata: {
        ...candidate.metadata,
        ...alt.metadata,
      },
    };
    swapped += 1;
  }

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

  updated.updatedAt = new Date().toISOString();
  return { trip: updated, swapped };
}

function pickMostExpensiveUnlocked(
  day: TripDay,
  exclude: Set<string>
): Stop | null {
  const unlocked = day.stops.filter((s) => !s.userLocked && !exclude.has(s.id));
  if (unlocked.length === 0) return null;
  return unlocked.reduce((best, s) =>
    estimateStopCostGbp(s) > estimateStopCostGbp(best) ? s : best
  );
}

async function fetchCheaperAlternative(
  trip: Trip,
  stop: Stop,
  maxPriceLevel: number,
  maxCostGbp: number
): Promise<AltCandidate | null> {
  try {
    const res = await fetch("/api/ai/replace-stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        destination: trip.destinationName,
        stopName: stop.name,
        category: stop.category,
        interests: trip.preferences.interests,
        destinationLat: stop.metadata?.lat ?? trip.destinationLat,
        destinationLng: stop.metadata?.lng ?? trip.destinationLng,
        maxPriceLevel,
        maxCostGbp,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { alternatives?: AltCandidate[] };
    const currentCost = estimateStopCostGbp(stop);
    return (
      (data.alternatives ?? []).find(
        (a) =>
          a.name !== stop.name &&
          altCostGbp(a) < currentCost &&
          altCostGbp(a) <= maxCostGbp &&
          (a.metadata?.priceLevel ?? 2) <= maxPriceLevel
      ) ?? null
    );
  } catch {
    return null;
  }
}
