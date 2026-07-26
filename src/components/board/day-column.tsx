"use client";

import { useEffect, useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";
import { Car, Footprints, Plus, Sparkles, TrainFront } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { SortableStopCard } from "@/components/board/stop-card";
import {
  DAY_BUDGET_MAX,
  DAY_BUDGET_MIN,
  DEFAULT_BUDGET_BY_TIER,
  estimateDaySpendGbp,
  formatGbp,
  formatGbpInr,
  resolveDayParty,
} from "@/lib/export/budget";
import {
  HOUR_HEIGHT_PX,
  buildCalendarWindow,
  layoutDayEvents,
  minutesToOffset,
  type CalendarWindow,
} from "@/lib/time/calendar-layout";
import { computeDayStats } from "@/lib/time/engine";
import type { Pace, Stop, TravelLeg, TripDay, TripPreferences } from "@/lib/types/trip";
import { formatMinutes, parseTimeToMinutes, cn } from "@/lib/utils";

interface DayColumnProps {
  day: TripDay;
  pace: Pace;
  preferences: TripPreferences;
  dayStartTime: string;
  dayEndTime: string;
  sharedWindow?: CalendarWindow;
  defaultBudgetPerDay?: number;
  gbpToInr?: number | null;
  isOver?: boolean;
  isRecalculating?: boolean;
  isAdjustingBudget?: boolean;
  showNowLine?: boolean;
  onStopSelect: (stop: Stop) => void;
  onOptimizeDay: () => void;
  onAddStop: () => void;
  onBudgetChange: (dayId: string, budgetGbp: number) => void;
  onPartyChange: (
    dayId: string,
    party: { adults: number; children: number; pets: number }
  ) => void;
}

function TransitIcon({ mode }: { mode: string }) {
  if (mode === "drive") return <Car className="h-3 w-3" />;
  if (mode === "transit") return <TrainFront className="h-3 w-3" />;
  return <Footprints className="h-3 w-3" />;
}

export function DayColumn({
  day,
  pace,
  preferences,
  dayStartTime,
  dayEndTime,
  sharedWindow,
  defaultBudgetPerDay = 80,
  gbpToInr,
  isOver,
  isRecalculating,
  isAdjustingBudget,
  showNowLine,
  onStopSelect,
  onOptimizeDay,
  onAddStop,
  onBudgetChange,
  onPartyChange,
}: DayColumnProps) {
  const { setNodeRef } = useDroppable({ id: day.id });
  const stats = computeDayStats(day, pace);
  const stopIds = day.stops.map((s) => s.id);
  const party = resolveDayParty(day, preferences);
  const budgetGbp =
    day.budgetGbp ?? defaultBudgetPerDay ?? DEFAULT_BUDGET_BY_TIER.mid;
  const spendGbp = estimateDaySpendGbp(day, preferences);
  const [draftBudget, setDraftBudget] = useState(budgetGbp);
  const overBudget = spendGbp > draftBudget && !day.isTransitDay;

  useEffect(() => {
    setDraftBudget(budgetGbp);
  }, [budgetGbp]);

  const window = useMemo(
    () => sharedWindow ?? buildCalendarWindow(dayStartTime, dayEndTime, day.stops),
    [sharedWindow, dayStartTime, dayEndTime, day.stops]
  );

  const events = useMemo(
    () => layoutDayEvents(day.stops, window),
    [day.stops, window]
  );

  const transitMarkers = useMemo(() => {
    const sorted = [...day.stops].sort((a, b) => a.sortOrder - b.sortOrder);
    const markers: Array<{
      key: string;
      top: number;
      leg: TravelLeg;
    }> = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i];
      const to = sorted[i + 1];
      const leg = day.travelLegs.find(
        (l) => l.fromStopId === from.id && l.toStopId === to.id
      );
      if (!leg) continue;
      const endMin = parseTimeToMinutes(from.scheduledEnd);
      const startNext = parseTimeToMinutes(to.scheduledStart);
      const mid = (endMin + startNext) / 2;
      const top = Math.max(
        0,
        minutesToOffset(mid, window.startMinutes) - 10
      );
      markers.push({ key: leg.id, top, leg });
    }
    return markers;
  }, [day.stops, day.travelLegs, window.startMinutes]);

  const nowOffset = useMemo(() => {
    if (!showNowLine) return null;
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins < window.startMinutes || mins > window.endMinutes) return null;
    return minutesToOffset(mins, window.startMinutes);
  }, [showNowLine, window]);

  const bumpParty = (key: "adults" | "children" | "pets", delta: number) => {
    const min = key === "adults" ? 1 : 0;
    onPartyChange(day.id, {
      ...party,
      [key]: Math.min(20, Math.max(min, party[key] + delta)),
    });
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "glass-card flex w-[340px] shrink-0 flex-col rounded-2xl transition-all duration-150 sm:w-[380px]",
        isOver && "ring-2 ring-accent/30",
        stats.isOverpacked && "border-t-4 border-t-amber-500",
        overBudget && "border-t-4 border-t-rose-500"
      )}
    >
      <div className="glass-panel flex min-h-[188px] flex-col justify-between rounded-t-2xl border-x-0 border-t-0 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-display truncate text-sm font-semibold text-card-fg">
              {day.label}
            </h3>
            <div className="mt-1.5 flex flex-wrap gap-2 text-[11px] tabular-nums text-card-muted">
              <span>{formatMinutes(stats.activeMinutes)} active</span>
              <span>·</span>
              <span>{formatMinutes(stats.travelMinutes)} travel</span>
            </div>
          </div>
          {(stats.isOverpacked || overBudget) && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                overBudget
                  ? "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
              )}
            >
              {overBudget ? "Over budget" : "Full day"}
            </span>
          )}
        </div>

        {!day.isTransitDay && (
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium text-card-fg">Day budget</span>
              <span
                className={cn(
                  "tabular-nums font-medium",
                  overBudget ? "text-rose-600 dark:text-rose-400" : "text-card-muted"
                )}
              >
                {formatGbpInr(spendGbp, gbpToInr)} / {formatGbp(draftBudget)}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-border">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  overBudget ? "bg-rose-500" : "bg-emerald-500"
                )}
                style={{
                  width: `${Math.min(100, (spendGbp / Math.max(draftBudget, 1)) * 100)}%`,
                }}
              />
            </div>
            <Slider
              value={[draftBudget]}
              onValueChange={([v]) => setDraftBudget(v)}
              onValueCommit={([v]) => onBudgetChange(day.id, v)}
              min={DAY_BUDGET_MIN}
              max={DAY_BUDGET_MAX}
              step={5}
              className="space-y-1"
            />
            <div className="flex flex-wrap gap-1.5 pt-0.5 text-[10px] text-card-muted">
              {(
                [
                  { key: "adults" as const, label: "A" },
                  { key: "children" as const, label: "C" },
                  { key: "pets" as const, label: "P" },
                ] as const
              ).map(({ key, label }) => (
                <span
                  key={key}
                  className="inline-flex items-center gap-0.5 rounded-md bg-black/5 px-1 py-0.5 dark:bg-white/5"
                >
                  <button
                    type="button"
                    className="px-0.5 hover:text-accent"
                    onClick={() => bumpParty(key, -1)}
                    aria-label={`Fewer ${key}`}
                  >
                    −
                  </button>
                  <span className="tabular-nums font-medium text-card-fg">
                    {label}
                    {party[key]}
                  </span>
                  <button
                    type="button"
                    className="px-0.5 hover:text-accent"
                    onClick={() => bumpParty(key, 1)}
                    aria-label={`More ${key}`}
                  >
                    +
                  </button>
                </span>
              ))}
            </div>
            {isAdjustingBudget && (
              <p className="text-[10px] text-accent">Adjusting places to fit…</p>
            )}
          </div>
        )}

        <div className="mt-2 flex gap-2">
          <Button variant="ghost" size="sm" onClick={onOptimizeDay} className="h-7 text-xs">
            <Sparkles className="h-3 w-3" />
            Optimize
          </Button>
          <Button variant="ghost" size="sm" onClick={onAddStop} className="h-7 text-xs">
            <Plus className="h-3 w-3" />
            Add stop
          </Button>
        </div>
      </div>

      <div className="relative flex-1 overflow-x-hidden px-2 pb-3 pt-1">
        <div className="relative w-full" style={{ height: window.totalHeight }}>
          {window.hours.map((m) => (
            <div
              key={m}
              className="pointer-events-none absolute right-0 left-0 border-t border-border/50"
              style={{
                top: ((m - window.startMinutes) / 60) * HOUR_HEIGHT_PX,
              }}
            />
          ))}
          {window.hours.map((m) => (
            <div
              key={`h-${m}`}
              className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-border/25"
              style={{
                top:
                  ((m - window.startMinutes) / 60) * HOUR_HEIGHT_PX +
                  HOUR_HEIGHT_PX / 2,
              }}
            />
          ))}

          {nowOffset != null && (
            <div
              className="pointer-events-none absolute right-0 left-0 z-10 flex items-center"
              style={{ top: nowOffset }}
            >
              <div className="h-2 w-2 -translate-x-1 rounded-full bg-violet-500 shadow-[0_0_0_3px_rgba(139,92,246,0.25)]" />
              <div className="h-px flex-1 bg-violet-500" />
            </div>
          )}

          {/* Transit between stops */}
          {transitMarkers.map(({ key, top, leg }) => (
            <div
              key={key}
              className="pointer-events-none absolute left-1/2 z-[5] -translate-x-1/2"
              style={{ top }}
            >
              <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-black/55 px-2 py-0.5 text-[10px] font-medium capitalize text-white shadow-sm backdrop-blur-md">
                <TransitIcon mode={leg.mode} />
                {leg.mode} · {leg.durationMinutes}m
              </span>
            </div>
          ))}

          <SortableContext items={stopIds} strategy={rectSortingStrategy}>
            {day.stops.length === 0 ? (
              <div className="absolute inset-4 flex items-center justify-center">
                <div className="glass-inset rounded-2xl border-dashed px-6 py-10 text-center">
                  <p className="text-sm text-card-muted">Drop a stop here</p>
                </div>
              </div>
            ) : (
              events.map((ev) => (
                <SortableStopCard
                  key={ev.stop.id}
                  id={ev.stop.id}
                  stop={ev.stop}
                  date={day.date}
                  gbpToInr={gbpToInr}
                  party={party}
                  isRecalculating={isRecalculating}
                  onSelect={() => onStopSelect(ev.stop)}
                  calendar={{
                    top: ev.top,
                    height: ev.height,
                    leftPct: (ev.col / ev.cols) * 100,
                    widthPct: 100 / ev.cols,
                  }}
                />
              ))
            )}
          </SortableContext>
        </div>
      </div>
    </div>
  );
}

export function useSharedCalendarWindow(
  days: TripDay[],
  dayStartTime: string,
  dayEndTime: string
) {
  return useMemo(() => {
    const allStops = days.flatMap((d) => d.stops);
    return buildCalendarWindow(dayStartTime, dayEndTime, allStops);
  }, [days, dayStartTime, dayEndTime]);
}
