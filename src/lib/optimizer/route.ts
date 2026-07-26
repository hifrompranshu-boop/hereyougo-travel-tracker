import type { OptimizationHint, Stop } from "@/lib/types/trip";
import { estimateTravelMinutes } from "@/lib/time/engine";

interface CoordStop {
  stop: Stop;
  lat: number;
  lng: number;
}

function distance(a: CoordStop, b: CoordStop): number {
  return estimateTravelMinutes(a.lat, a.lng, b.lat, b.lng, "walk");
}

function nearestNeighborOrder(stops: CoordStop[]): CoordStop[] {
  if (stops.length <= 1) return stops;

  const remaining = [...stops];
  const ordered: CoordStop[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let bestIdx = 0;
    let bestDist = Infinity;

    remaining.forEach((candidate, idx) => {
      const d = distance(last, candidate);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = idx;
      }
    });

    ordered.push(remaining.splice(bestIdx, 1)[0]);
  }

  return ordered;
}

function twoOptImprove(route: CoordStop[]): CoordStop[] {
  if (route.length < 4) return route;

  let improved = true;
  let best = [...route];

  while (improved) {
    improved = false;
    for (let i = 1; i < best.length - 2; i++) {
      for (let j = i + 1; j < best.length - 1; j++) {
        const current =
          distance(best[i - 1], best[i]) + distance(best[j], best[j + 1]);
        const swapped =
          distance(best[i - 1], best[j]) + distance(best[i], best[j + 1]);

        if (swapped < current - 1) {
          const newRoute = [
            ...best.slice(0, i),
            ...best.slice(i, j + 1).reverse(),
            ...best.slice(j + 1),
          ];
          best = newRoute;
          improved = true;
        }
      }
    }
  }

  return best;
}

export function optimizeStopOrder(stops: Stop[]): Stop[] {
  const withCoords: CoordStop[] = stops
    .filter((s) => s.metadata?.lat && s.metadata?.lng)
    .map((s) => ({
      stop: s,
      lat: s.metadata!.lat!,
      lng: s.metadata!.lng!,
    }));

  const locked = stops.filter((s) => s.userLocked);
  const unlocked = stops.filter((s) => !s.userLocked);

  if (unlocked.length <= 1) return stops;

  const unlockedCoords = withCoords.filter((c) =>
    unlocked.some((s) => s.id === c.stop.id)
  );

  if (unlockedCoords.length <= 1) return stops;

  let ordered = nearestNeighborOrder(unlockedCoords);
  ordered = twoOptImprove(ordered);

  const orderedIds = ordered.map((c) => c.stop.id);
  const lockedIds = new Set(locked.map((s) => s.id));

  const result: Stop[] = [];
  let orderIdx = 0;

  for (const stop of [...stops].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (lockedIds.has(stop.id)) {
      result.push(stop);
    } else {
      const optimized = ordered.find((c) => c.stop.id === orderedIds[orderIdx]);
      if (optimized) {
        result.push(optimized.stop);
        orderIdx++;
      }
    }
  }

  return result.map((stop, index) => ({ ...stop, sortOrder: index }));
}

export function suggestOptimization(stops: Stop[]): OptimizationHint | null {
  if (stops.length < 3) return null;

  const withCoords = stops
    .filter((s) => s.metadata?.lat && s.metadata?.lng)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (withCoords.length < 3) return null;

  let bestSaving = 0;
  let bestI = -1;

  for (let i = 0; i < withCoords.length - 2; i++) {
    const a = withCoords[i];
    const b = withCoords[i + 1];
    const c = withCoords[i + 2];

    const current =
      estimateTravelMinutes(
        a.metadata!.lat!,
        a.metadata!.lng!,
        b.metadata!.lat!,
        b.metadata!.lng!,
        "walk"
      ) +
      estimateTravelMinutes(
        b.metadata!.lat!,
        b.metadata!.lng!,
        c.metadata!.lat!,
        c.metadata!.lng!,
        "walk"
      );

    const swapped =
      estimateTravelMinutes(
        a.metadata!.lat!,
        a.metadata!.lng!,
        c.metadata!.lat!,
        c.metadata!.lng!,
        "walk"
      ) +
      estimateTravelMinutes(
        c.metadata!.lat!,
        c.metadata!.lng!,
        b.metadata!.lat!,
        b.metadata!.lng!,
        "walk"
      );

    const saving = current - swapped;
    if (saving > bestSaving) {
      bestSaving = saving;
      bestI = i;
    }
  }

  if (bestSaving >= 5 && bestI >= 0) {
    const a = withCoords[bestI];
    const c = withCoords[bestI + 2];
    return {
      message: `Move "${c.name}" before "${withCoords[bestI + 1].name}" to save ~${bestSaving} min`,
      fromStopId: c.id,
      toStopId: withCoords[bestI + 1].id,
      savingsMinutes: bestSaving,
    };
  }

  return null;
}

export function totalRouteMinutes(stops: Stop[]): number {
  const sorted = [...stops]
    .filter((s) => s.metadata?.lat && s.metadata?.lng)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  let total = sorted.reduce((sum, s) => sum + s.durationMinutes, 0);

  for (let i = 0; i < sorted.length - 1; i++) {
    total += estimateTravelMinutes(
      sorted[i].metadata!.lat!,
      sorted[i].metadata!.lng!,
      sorted[i + 1].metadata!.lat!,
      sorted[i + 1].metadata!.lng!,
      "walk"
    );
  }

  return total;
}
