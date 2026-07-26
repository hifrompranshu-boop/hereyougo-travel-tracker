"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Download,
  LayoutGrid,
  List,
  Map as MapIcon,
  MoreHorizontal,
  Share2,
  Sparkles,
  CloudRain,
  Loader2,
  Send,
  X,
} from "lucide-react";
import { DayColumn, useSharedCalendarWindow } from "@/components/board/day-column";
import { TimeGutter } from "@/components/board/time-gutter";
import { StopCardOverlay } from "@/components/board/stop-card";
import { StopDetailPanel } from "@/components/board/stop-detail-panel";
import { AddStopDialog } from "@/components/board/add-stop-dialog";
import { OptimizeDialog } from "@/components/board/optimize-dialog";
import { TripMapDynamic } from "@/components/board/trip-map-dynamic";
import { TripTimeline } from "@/components/board/trip-timeline";
import { SyncBanner } from "@/components/auth/sync-banner";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { saveTrip } from "@/lib/db/local";
import { downloadIcs } from "@/lib/export/calendar";
import {
  estimateDaySpendGbp,
  estimateTripBudget,
  formatGbpInr,
  resolveDayParty,
} from "@/lib/export/budget";
import { useGbpToInrRate } from "@/hooks/use-gbp-inr-rate";
import { minutesToOffset } from "@/lib/time/calendar-layout";
import { suggestOptimization } from "@/lib/optimizer/route";
import { createShareLink, syncTripToCloud } from "@/lib/sync/cloud";
import { adjustDayToBudget } from "@/lib/trip/budget-adjust";
import {
  applyPreferenceReplacements,
  moveStopBetweenDays,
  optimizeAllDays,
  optimizeDay,
  reorderStopInDay,
  removeStop,
  type PreferenceReplacement,
} from "@/lib/trip/builder";
import { getStopPartyGuidelines } from "@/lib/trip/party-compat";
import { refreshTripTravelAfterChange } from "@/lib/trip/refresh-travel";
import type { OptimizationHint, Stop, Trip } from "@/lib/types/trip";
import { exportTripJson } from "@/lib/db/local";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type BoardView = "board" | "map" | "timeline";
type DayFilter = "all" | number;

const DAY_HEADER_OFFSET = 200;

interface KanbanBoardProps {
  initialTrip: Trip;
  onTripChange?: (trip: Trip) => void;
}

export function KanbanBoard({ initialTrip, onTripChange }: KanbanBoardProps) {
  const [trip, setTrip] = useState(initialTrip);
  const [activeStop, setActiveStop] = useState<Stop | null>(null);
  const [activeDayId, setActiveDayId] = useState<string | null>(null);
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null);
  const [recalculatingDays, setRecalculatingDays] = useState<Set<string>>(new Set());
  const [optimizationHint, setOptimizationHint] = useState<OptimizationHint | null>(null);
  const [addStopDayId, setAddStopDayId] = useState<string | null>(null);
  const [showOptimizeAll, setShowOptimizeAll] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [weatherNote, setWeatherNote] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>("board");
  const [dayFilter, setDayFilter] = useState<DayFilter>("all");
  const [adjustingDayId, setAdjustingDayId] = useState<string | null>(null);
  const [prefDraft, setPrefDraft] = useState("");
  const [applyingPrefs, setApplyingPrefs] = useState(false);
  const undoRef = useRef<{ trip: Trip; label: string } | null>(null);
  const { toast } = useToast();
  const { rate: gbpToInr } = useGbpToInrRate();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const updateTrip = useCallback(
    async (updated: Trip, undoLabel?: string) => {
      if (undoLabel) {
        undoRef.current = { trip, label: undoLabel };
      }
      setTrip(updated);
      onTripChange?.(updated);
      await saveTrip(updated);

      if (undoLabel) {
        toast({
          title: undoLabel,
          action: {
            label: "Undo",
            onClick: () => {
              if (undoRef.current) {
                setTrip(undoRef.current.trip);
                saveTrip(undoRef.current.trip);
                undoRef.current = null;
              }
            },
          },
        });
      }
    },
    [trip, onTripChange, toast]
  );

  useEffect(() => {
    const timer = setTimeout(() => saveTrip(trip), 500);
    return () => clearTimeout(timer);
  }, [trip]);

  useEffect(() => {
    if (!trip.destinationLat || !trip.destinationLng) return;
    fetch(
      `/api/weather?lat=${trip.destinationLat}&lon=${trip.destinationLng}&date=${trip.startDate}`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.isOutdoorFriendly) {
          setWeatherNote(`Weather: ${data.condition}. Consider swapping outdoor stops.`);
        }
      })
      .catch(() => {});
  }, [trip.destinationLat, trip.destinationLng, trip.startDate]);

  const findStopDay = (stopId: string) =>
    trip.days.find((d) => d.stops.some((s) => s.id === stopId));

  const handleDragStart = (event: DragStartEvent) => {
    const stopId = event.active.id as string;
    const day = findStopDay(stopId);
    const stop = day?.stops.find((s) => s.id === stopId);
    if (stop && day) {
      setActiveStop(stop);
      setActiveDayId(day.id);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeDay = findStopDay(activeId);
    let overDay = trip.days.find((d) => d.id === overId);
    if (!overDay) {
      overDay = findStopDay(overId);
    }
    if (!activeDay || !overDay || activeDay.id === overDay.id) return;

    const activeIndex = activeDay.stops.findIndex((s) => s.id === activeId);
    const overIndex = overDay.stops.findIndex((s) => s.id === overId);
    const newIndex = overIndex >= 0 ? overIndex : overDay.stops.length;

    const updated = moveStopBetweenDays(trip, activeId, activeDay.id, overDay.id, newIndex);
    setTrip(updated);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveStop(null);
    setActiveDayId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;
    const activeDay = findStopDay(activeId);

    if (!activeDay) return;

    let updated = trip;
    const affectedDays = new Set<string>();

    if (activeDay.stops.some((s) => s.id === overId)) {
      const oldIndex = activeDay.stops.findIndex((s) => s.id === activeId);
      const newIndex = activeDay.stops.findIndex((s) => s.id === overId);
      if (oldIndex !== newIndex) {
        updated = reorderStopInDay(trip, activeDay.id, activeId, newIndex);
        affectedDays.add(activeDay.id);
      }
    } else {
      affectedDays.add(activeDay.id);
      const overDay = trip.days.find((d) => d.id === overId) ?? findStopDay(overId);
      if (overDay) affectedDays.add(overDay.id);
    }

    if (affectedDays.size === 0) return;

    setRecalculatingDays(affectedDays);
    try {
      updated = await refreshTripTravelAfterChange(
        updated,
        Array.from(affectedDays)
      );
      await updateTrip(updated, "Stop moved · travel updated");
      const day = updated.days.find((d) => d.id === activeDay.id);
      if (day) setOptimizationHint(suggestOptimization(day.stops));
    } finally {
      setTimeout(() => setRecalculatingDays(new Set()), 400);
    }
  };

  const handleOptimizeDay = async (dayId: string) => {
    setRecalculatingDays(new Set([dayId]));
    let updated = optimizeDay(trip, dayId);
    updated = await refreshTripTravelAfterChange(updated, [dayId]);
    await updateTrip(updated, "Day optimized");
    setRecalculatingDays(new Set());
    toast({ title: "Day route optimized", variant: "success" });
  };

  const handleOptimizeAll = async () => {
    let updated = optimizeAllDays(trip);
    updated = await refreshTripTravelAfterChange(
      updated,
      updated.days.map((d) => d.id)
    );
    await updateTrip(updated);
    setShowOptimizeAll(false);
    toast({ title: "All days optimized", variant: "success" });
  };

  const handleRemoveStop = async (dayId: string, stopId: string) => {
    let updated = removeStop(trip, dayId, stopId);
    updated = await refreshTripTravelAfterChange(updated, [dayId]);
    await updateTrip(updated, "Stop removed");
    setSelectedStop(null);
  };

  const handlePartyChangeAll = async (party: {
    adults: number;
    children: number;
    pets: number;
  }) => {
    const updated = structuredClone(trip);
    updated.preferences.adults = party.adults;
    updated.preferences.children = party.children;
    updated.preferences.pets = party.pets;
    for (const day of updated.days) {
      if (day.isTransitDay) continue;
      day.adults = party.adults;
      day.children = party.children;
      day.pets = party.pets;
    }
    await updateTrip(updated, "Updated party for all days");
    warnPartyGuidelines(updated, party);
  };

  const warnPartyGuidelines = (
    nextTrip: Trip,
    party: { adults: number; children: number; pets: number }
  ) => {
    if (party.pets <= 0 && party.children <= 0) return;
    let n = 0;
    for (const day of nextTrip.days) {
      for (const stop of day.stops) {
        n += getStopPartyGuidelines(stop, party).length;
      }
    }
    if (n > 0) {
      toast({
        title: `${n} stop${n === 1 ? "" : "s"} may need a check for your party`,
        description: "Look for the glowing i on those cards.",
        variant: "warning",
      });
    }
  };

  const handleDayPartyChange = async (
    dayId: string,
    party: { adults: number; children: number; pets: number }
  ) => {
    const updated = structuredClone(trip);
    const day = updated.days.find((d) => d.id === dayId);
    if (!day) return;
    day.adults = party.adults;
    day.children = party.children;
    day.pets = party.pets;
    await updateTrip(updated);
    warnPartyGuidelines(
      { ...updated, days: [day] },
      party
    );
  };

  const handleShare = async () => {
    try {
      const url = await createShareLink(trip);
      const fullUrl = `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      toast({ title: "Share link copied!", variant: "success" });
    } catch {
      toast({ title: "Failed to create share link", variant: "warning" });
    }
  };

  const handleExportJson = () => {
    const json = exportTripJson(trip);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${trip.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSync = async (userId: string) => {
    try {
      const synced = await syncTripToCloud(trip, userId);
      setTrip(synced);
      toast({ title: "Trip synced to cloud", variant: "success" });
    } catch {
      toast({ title: "Sync failed", variant: "warning" });
    }
  };

  const handleDayBudgetChange = useCallback(
    async (dayId: string, budgetGbp: number) => {
      setAdjustingDayId(dayId);
      try {
        const { trip: next, swapped } = await adjustDayToBudget(
          trip,
          dayId,
          budgetGbp
        );
        await updateTrip(
          next,
          swapped > 0
            ? `Adjusted ${swapped} stop${swapped === 1 ? "" : "s"} to fit budget`
            : "Updated day budget"
        );
        if (swapped === 0) {
          const day = next.days.find((d) => d.id === dayId);
          if (day && estimateDaySpendGbp(day) > budgetGbp) {
            toast({
              title: "Still over budget — unlock stops or swap manually",
              variant: "warning",
            });
          }
        }
      } finally {
        setAdjustingDayId(null);
      }
    },
    [trip, updateTrip, toast]
  );

  const handleApplyPreferences = useCallback(async () => {
    const instruction = prefDraft.trim();
    if (!instruction || applyingPrefs) return;
    setApplyingPrefs(true);
    try {
      const res = await fetch("/api/ai/apply-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: trip.destinationName,
          instruction: `${instruction} (Party: ${trip.preferences.adults} adults, ${trip.preferences.children} children, ${trip.preferences.pets} pets)`,
          destinationLat: trip.destinationLat,
          destinationLng: trip.destinationLng,
          days: trip.days
            .filter((d) => !d.isTransitDay)
            .map((d) => ({
              dayIndex: d.dayIndex,
              label: d.label,
              stops: d.stops.map((s) => ({
                name: s.name,
                category: s.category,
                locked: Boolean(s.userLocked),
              })),
            })),
        }),
      });
      if (!res.ok) throw new Error("Failed");
      const data = (await res.json()) as {
        replacements?: PreferenceReplacement[];
        summary?: string;
      };
      let next = applyPreferenceReplacements(
        trip,
        data.replacements ?? [],
        instruction
      );
      next = await refreshTripTravelAfterChange(
        next,
        next.days.map((d) => d.id)
      );
      await updateTrip(next, data.summary || "Updated itinerary from your note");
      setPrefDraft("");
      toast({
        title: data.summary || "Itinerary updated",
        variant: "success",
      });
    } catch {
      toast({ title: "Couldn’t apply preferences", variant: "warning" });
    } finally {
      setApplyingPrefs(false);
    }
  }, [prefDraft, applyingPrefs, trip, updateTrip, toast]);

  const budget = estimateTripBudget(trip);
  const activeStopDay = activeStop ? findStopDay(activeStop.id) : null;
  const footerKind = weatherNote
    ? ("weather" as const)
    : optimizationHint
      ? ("hint" as const)
      : null;
  const footerText =
    footerKind === "weather"
      ? weatherNote
      : footerKind === "hint"
        ? optimizationHint?.message ?? null
        : null;
  const calendarWindow = useSharedCalendarWindow(
    trip.days,
    trip.preferences.dayStartTime,
    trip.preferences.dayEndTime
  );
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const nowOffset = (() => {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (
      mins < calendarWindow.startMinutes ||
      mins > calendarWindow.endMinutes
    ) {
      return null;
    }
    return minutesToOffset(mins, calendarWindow.startMinutes);
  })();

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SyncBanner trip={trip} onSync={handleSync} />

      <div className="glass-panel border-b border-border/80 px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Link
              href="/"
              className="mt-0.5 rounded-xl p-2 text-muted hover:bg-accent/10 hover:text-foreground"
              aria-label="Back to trips"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {trip.title}
              </h1>
              <p className="mt-0.5 text-sm text-muted">
                {trip.destinationName} · {trip.numDays} days ·{" "}
                <span className="capitalize">{trip.preferences.pace}</span> pace
                {budget.total > 0 && (
                  <span> · ~{formatGbpInr(budget.total, gbpToInr)} est.</span>
                )}
                <span>
                  {" "}
                  · {trip.preferences.adults}A
                  {trip.preferences.children > 0
                    ? ` · ${trip.preferences.children}C`
                    : ""}
                  {trip.preferences.pets > 0
                    ? ` · ${trip.preferences.pets}P`
                    : ""}
                </span>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowOptimizeAll(true)}>
              <Sparkles className="h-4 w-4" />
              Optimize all
            </Button>
            <Button variant="secondary" size="sm" onClick={handleShare}>
              <Share2 className="h-4 w-4" />
              Share
            </Button>
            <div className="relative">
              <Button variant="ghost" size="icon" onClick={() => setShowMenu(!showMenu)}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
              {showMenu && (
                <div className="glass-panel absolute right-0 top-full z-50 mt-1 w-48 rounded-xl py-1 shadow-glass">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/10"
                    onClick={() => { downloadIcs(trip); setShowMenu(false); }}
                  >
                    <Download className="h-4 w-4" /> Export calendar
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-4 py-2 text-sm text-foreground hover:bg-accent/10"
                    onClick={() => { handleExportJson(); setShowMenu(false); }}
                  >
                    <Download className="h-4 w-4" /> Export JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-3 flex max-w-[1400px] flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted">Party (all days)</span>
            {(
              [
                { key: "adults" as const, label: "Adults" },
                { key: "children" as const, label: "Children" },
                { key: "pets" as const, label: "Pets" },
              ] as const
            ).map(({ key, label }) => (
              <div
                key={key}
                className="glass-inset inline-flex h-9 items-center gap-1 rounded-xl px-2 text-xs"
              >
                <span className="text-card-muted">{label}</span>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-card-fg hover:bg-accent/10"
                  onClick={() =>
                    void handlePartyChangeAll({
                      adults: trip.preferences.adults,
                      children: trip.preferences.children,
                      pets: trip.preferences.pets,
                      [key]: Math.max(
                        key === "adults" ? 1 : 0,
                        trip.preferences[key] - 1
                      ),
                    })
                  }
                  aria-label={`Fewer ${label}`}
                >
                  −
                </button>
                <span className="min-w-[1.25rem] text-center font-semibold tabular-nums text-card-fg">
                  {trip.preferences[key]}
                </span>
                <button
                  type="button"
                  className="flex h-6 w-6 items-center justify-center rounded-lg text-card-fg hover:bg-accent/10"
                  onClick={() =>
                    void handlePartyChangeAll({
                      adults: trip.preferences.adults,
                      children: trip.preferences.children,
                      pets: trip.preferences.pets,
                      [key]: Math.min(20, trip.preferences[key] + 1),
                    })
                  }
                  aria-label={`More ${label}`}
                >
                  +
                </button>
              </div>
            ))}
          </div>

          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void handleApplyPreferences();
            }}
          >
            <input
              value={prefDraft}
              onChange={(e) => setPrefDraft(e.target.value)}
              placeholder="Preferences or changes — e.g. more museums, skip nightlife, indoor-friendly…"
              disabled={applyingPrefs}
              className="glass-inset h-9 min-w-0 flex-1 rounded-xl px-3.5 text-sm text-card-fg placeholder:text-card-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:opacity-60"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!prefDraft.trim() || applyingPrefs}
              className="h-9 shrink-0"
            >
              {applyingPrefs ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Apply
            </Button>
          </form>

          <div className="flex flex-wrap items-center gap-3">
            <div className="glass-inset inline-flex w-fit items-center gap-1 rounded-full p-1">
              {(
                [
                  { id: "board" as const, label: "Calendar", icon: LayoutGrid },
                  { id: "map" as const, label: "Map", icon: MapIcon },
                  { id: "timeline" as const, label: "List", icon: List },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                    view === tab.id
                      ? "bg-accent text-white"
                      : "text-muted hover:bg-accent/10 hover:text-foreground"
                  )}
                >
                  <tab.icon className="h-4 w-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {(view === "map" || view === "timeline") && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setDayFilter("all")}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                    dayFilter === "all"
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted hover:border-accent/40 hover:text-foreground"
                  )}
                >
                  All days
                </button>
                {trip.days.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => setDayFilter(d.dayIndex)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      dayFilter === d.dayIndex
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border text-muted hover:border-accent/40 hover:text-foreground"
                    )}
                  >
                    Day {d.dayIndex + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {view === "board" && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div
            className={cn(
              "board-scroll flex flex-1 overflow-x-auto overflow-y-auto px-2 py-6 sm:px-4",
              footerKind && "pb-14"
            )}
          >
            <div className="mx-auto flex min-w-max items-start gap-3 sm:gap-4">
              <div className="sticky left-0 z-20 shrink-0 bg-background/40 backdrop-blur-md">
                <TimeGutter
                  window={calendarWindow}
                  headerOffset={DAY_HEADER_OFFSET}
                  nowOffset={nowOffset}
                  className="pt-0"
                />
              </div>
              {trip.days.map((day) => (
                <DayColumn
                  key={day.id}
                  day={day}
                  pace={trip.preferences.pace}
                  preferences={trip.preferences}
                  dayStartTime={trip.preferences.dayStartTime}
                  dayEndTime={trip.preferences.dayEndTime}
                  sharedWindow={calendarWindow}
                  defaultBudgetPerDay={trip.preferences.defaultBudgetPerDay}
                  gbpToInr={gbpToInr}
                  isOver={activeDayId !== day.id && activeStop !== null}
                  isRecalculating={recalculatingDays.has(day.id)}
                  isAdjustingBudget={adjustingDayId === day.id}
                  showNowLine={day.date === todayStr}
                  onStopSelect={setSelectedStop}
                  onOptimizeDay={() => handleOptimizeDay(day.id)}
                  onAddStop={() => setAddStopDayId(day.id)}
                  onBudgetChange={handleDayBudgetChange}
                  onPartyChange={handleDayPartyChange}
                />
              ))}
            </div>
          </div>

          <DragOverlay dropAnimation={{ duration: 200, easing: "cubic-bezier(0.18, 0.67, 0.6, 1)" }}>
            {activeStop && activeStopDay ? (
              <StopCardOverlay
                stop={activeStop}
                date={activeStopDay.date}
                gbpToInr={gbpToInr}
                party={resolveDayParty(activeStopDay, trip.preferences)}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {view === "map" && (
        <div className={cn("flex-1 px-4 py-6 sm:px-6", footerKind && "pb-14")}>
          <div className="mx-auto max-w-[1400px]">
            <TripMapDynamic
              trip={trip}
              dayFilter={dayFilter}
              onStopSelect={setSelectedStop}
            />
            <p className="mt-3 text-xs text-muted">
              Interactive map — scroll to zoom, drag to pan, click markers for details.
            </p>
          </div>
        </div>
      )}

      {view === "timeline" && (
        <div
          className={cn(
            "flex-1 overflow-y-auto px-4 py-6 sm:px-6",
            footerKind && "pb-14"
          )}
        >
          <TripTimeline
            trip={trip}
            dayFilter={dayFilter}
            onStopSelect={setSelectedStop}
          />
        </div>
      )}

      <StopDetailPanel
        stop={selectedStop}
        day={selectedStop ? findStopDay(selectedStop.id) : undefined}
        trip={trip}
        onClose={() => setSelectedStop(null)}
        onUpdate={updateTrip}
        onRemove={handleRemoveStop}
      />

      {addStopDayId && (
        <AddStopDialog
          destination={trip.destinationName}
          destinationLat={trip.destinationLat}
          destinationLng={trip.destinationLng}
          dayId={addStopDayId}
          trip={trip}
          onClose={() => setAddStopDayId(null)}
          onAdd={async (next) => {
            const dayId = addStopDayId;
            const refreshed = await refreshTripTravelAfterChange(next, [dayId]);
            await updateTrip(refreshed, "Stop added · travel updated");
          }}
        />
      )}

      {showOptimizeAll && (
        <OptimizeDialog
          trip={trip}
          onConfirm={handleOptimizeAll}
          onClose={() => setShowOptimizeAll(false)}
        />
      )}

      <AnimatePresence>
        {footerKind && footerText && (
          <motion.footer
            key={`footer-${footerKind}`}
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className={cn(
              "fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md",
              footerKind === "weather"
                ? "border-amber-500/30 bg-amber-50/95 text-amber-900 dark:border-amber-500/25 dark:bg-amber-950/90 dark:text-amber-100"
                : "border-accent/25 bg-background/90 text-foreground"
            )}
          >
            <div className="mx-auto flex h-9 max-w-[1400px] items-center gap-2 px-4 text-xs sm:px-6">
              {footerKind === "weather" ? (
                <CloudRain className="h-3.5 w-3.5 shrink-0 opacity-90" />
              ) : (
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
              )}
              <p className="min-w-0 flex-1 truncate leading-none">{footerText}</p>
              <button
                type="button"
                onClick={() => {
                  if (footerKind === "weather") setWeatherNote(null);
                  else setOptimizationHint(null);
                }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium opacity-80 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                aria-label="Dismiss"
              >
                <X className="h-3 w-3" />
                Dismiss
              </button>
            </div>
          </motion.footer>
        )}
      </AnimatePresence>
    </div>
  );
}
