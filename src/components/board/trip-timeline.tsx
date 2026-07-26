"use client";

import { format, parseISO } from "date-fns";
import {
  Car,
  Footprints,
  TrainFront,
  Utensils,
  Coffee,
  MapPin,
} from "lucide-react";
import { PlaceMeta } from "@/components/places/place-meta";
import { getCategoryIcon } from "@/lib/constants";
import { estimateStopCostGbp } from "@/lib/export/budget";
import { useGbpToInrRate } from "@/hooks/use-gbp-inr-rate";
import { getStopHoursStatus } from "@/lib/time/engine";
import type { Stop, TravelLeg, Trip, TripDay } from "@/lib/types/trip";
import { cn, formatMinutes } from "@/lib/utils";

type DayFilter = "all" | number;

interface TripTimelineProps {
  trip: Trip;
  dayFilter: DayFilter;
  onStopSelect?: (stop: Stop) => void;
}

function modeIcon(mode: string) {
  if (mode === "drive") return <Car className="h-3.5 w-3.5" />;
  if (mode === "transit") return <TrainFront className="h-3.5 w-3.5" />;
  return <Footprints className="h-3.5 w-3.5" />;
}

function mealIcon(category: string) {
  if (/restaurant|food/i.test(category)) return <Utensils className="h-3.5 w-3.5" />;
  if (/cafe|coffee/i.test(category)) return <Coffee className="h-3.5 w-3.5" />;
  return null;
}

function DayTimeline({
  day,
  onStopSelect,
  gbpToInr,
}: {
  day: TripDay;
  onStopSelect?: (stop: Stop) => void;
  gbpToInr?: number | null;
}) {
  const sorted = [...day.stops].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <section className="relative">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-semibold text-foreground">{day.label}</h3>
        <p className="text-xs text-muted">
          {sorted.length} stops ·{" "}
          {formatMinutes(
            sorted.reduce((n, s) => n + s.durationMinutes, 0) +
              day.travelLegs.reduce((n, l) => n + l.durationMinutes, 0)
          )}{" "}
          total
        </p>
      </div>

      <ol className="relative space-y-0 border-l-2 border-border pl-6">
        {sorted.map((stop, index) => {
          const leg: TravelLeg | undefined = day.travelLegs.find(
            (l) => l.fromStopId === stop.id
          );
          const next = sorted[index + 1];
          const hours = getStopHoursStatus(stop, day.date);
          const meal = mealIcon(stop.category);

          return (
            <li key={stop.id} className="relative pb-8 last:pb-0">
              <span
                className={cn(
                  "absolute -left-[31px] top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white",
                  /restaurant|cafe|market/i.test(stop.category)
                    ? "bg-orange-500"
                    : "bg-accent"
                )}
              >
                {index + 1}
              </span>

              <button
                type="button"
                onClick={() => onStopSelect?.(stop)}
                className="glass-card w-full rounded-xl p-4 text-left transition-colors hover:ring-1 hover:ring-accent/35"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {getCategoryIcon(stop.category)} {stop.name}
                    </p>
                    <PlaceMeta
                      className="mt-1"
                      rating={stop.metadata?.rating}
                      priceLevel={stop.metadata?.priceLevel}
                      estimatedCostGbp={estimateStopCostGbp(stop)}
                      gbpToInr={gbpToInr}
                    />
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span className="capitalize">{stop.category}</span>
                      {meal && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-600 dark:text-orange-300">
                          {meal}
                          {/dinner/i.test(stop.notes ?? "")
                            ? "Dinner"
                            : /lunch/i.test(stop.notes ?? "")
                              ? "Lunch"
                              : "Meal"}
                        </span>
                      )}
                      {hours !== "unknown" && (
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5",
                            hours === "open" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
                            hours === "closed" && "bg-red-500/15 text-red-700 dark:text-red-300",
                            hours === "opens-later" && "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {hours === "open"
                            ? "Open"
                            : hours === "closed"
                              ? "Closed"
                              : "Opens later"}
                        </span>
                      )}
                    </p>
                    {stop.metadata?.formattedAddress && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                        <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                        {stop.metadata.formattedAddress}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right text-xs tabular-nums text-muted">
                    <p className="font-medium text-foreground">
                      {stop.scheduledStart} – {stop.scheduledEnd}
                    </p>
                    <p className="mt-1">{stop.durationMinutes}m visit</p>
                  </div>
                </div>
              </button>

              {leg && next && (
                <div className="my-3 ml-1 flex items-center gap-2 text-xs text-muted">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-1">
                    {modeIcon(leg.mode)}
                    <span className="capitalize">{leg.mode}</span>
                    <span className="tabular-nums font-medium text-foreground">
                      {leg.durationMinutes}m
                    </span>
                    {leg.distanceMeters > 0 && (
                      <span>· {(leg.distanceMeters / 1000).toFixed(1)} km</span>
                    )}
                  </span>
                  <span className="text-muted/80">to {next.name}</span>
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function TripTimeline({ trip, dayFilter, onStopSelect }: TripTimelineProps) {
  const { rate: gbpToInr } = useGbpToInrRate();
  const days =
    dayFilter === "all"
      ? trip.days
      : trip.days.filter((d) => d.dayIndex === dayFilter);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-1 py-2">
      <div>
        <h2 className="font-display text-xl font-semibold text-foreground">Trip timeline</h2>
        <p className="mt-1 text-sm text-muted">
          {trip.destinationName} · starts{" "}
          {format(parseISO(trip.startDate), "MMM d, yyyy")} · {trip.numDays} days
        </p>
      </div>

      {days.map((day) => (
        <DayTimeline
          key={day.id}
          day={day}
          onStopSelect={onStopSelect}
          gbpToInr={gbpToInr}
        />
      ))}

      {days.length === 0 && (
        <p className="text-sm text-muted">No days to show for this filter.</p>
      )}
    </div>
  );
}
