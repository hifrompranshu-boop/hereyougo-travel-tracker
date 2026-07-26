"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Star,
  MapPin,
  ExternalLink,
  Trash2,
  RefreshCw,
  Lock,
  LockOpen,
  ArrowLeftRight,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { PlaceMeta } from "@/components/places/place-meta";
import { getCategoryIcon } from "@/lib/constants";
import {
  costGbpFromPriceLevel,
  estimateStopCostGbp,
  formatGbpInr,
} from "@/lib/export/budget";
import { useGbpToInrRate } from "@/hooks/use-gbp-inr-rate";
import { getStopHoursStatus } from "@/lib/time/engine";
import {
  formatDurationLabel,
  formatPriceLevel,
} from "@/lib/time/hours";
import { moveStopBetweenDays } from "@/lib/trip/builder";
import type { Stop, Trip, TripDay } from "@/lib/types/trip";
import { cn } from "@/lib/utils";

type Alt = {
  name: string;
  category: string;
  durationMinutes: number;
  placeId?: string;
  metadata?: Stop["metadata"];
};

interface StopDetailPanelProps {
  stop: Stop | null;
  day?: TripDay;
  trip: Trip;
  onClose: () => void;
  onUpdate: (trip: Trip) => void;
  onRemove: (dayId: string, stopId: string) => void;
}

export function StopDetailPanel({
  stop,
  day,
  trip,
  onClose,
  onUpdate,
  onRemove,
}: StopDetailPanelProps) {
  const [duration, setDuration] = useState(stop?.durationMinutes ?? 60);
  const [locked, setLocked] = useState(Boolean(stop?.userLocked));
  const [alternatives, setAlternatives] = useState<Alt[]>([]);
  const [loadingAlts, setLoadingAlts] = useState(false);
  const [altsLoaded, setAltsLoaded] = useState(false);
  const [swapQuery, setSwapQuery] = useState("");
  const [searchingSwap, setSearchingSwap] = useState(false);
  const { rate: gbpToInr } = useGbpToInrRate();

  useEffect(() => {
    if (stop) {
      setDuration(stop.durationMinutes);
      setLocked(Boolean(stop.userLocked));
      setAlternatives([]);
      setAltsLoaded(false);
      setSwapQuery("");
    }
  }, [stop]);

  const open = Boolean(stop && day);

  // Auto-load nearby alternatives when panel opens
  useEffect(() => {
    if (!open || !stop) return;
    void loadAlternatives();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, stop?.id]);

  useEffect(() => {
    if (!open) return;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    const blockBackgroundScroll = (e: Event) => {
      const target = e.target as Node | null;
      const scrollArea = document.querySelector("[data-stop-panel-scroll]");
      if (scrollArea && target && scrollArea.contains(target)) return;
      e.preventDefault();
    };
    document.addEventListener("wheel", blockBackgroundScroll, { passive: false });
    document.addEventListener("touchmove", blockBackgroundScroll, { passive: false });

    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
      document.removeEventListener("wheel", blockBackgroundScroll);
      document.removeEventListener("touchmove", blockBackgroundScroll);
    };
  }, [open]);

  const hoursStatus = stop && day ? getStopHoursStatus(stop, day.date) : "unknown";
  const priceLabel = formatPriceLevel(stop?.metadata?.priceLevel);
  const stopCostGbp = stop ? estimateStopCostGbp(stop) : 0;
  const description =
    stop?.notes ||
    stop?.metadata?.description ||
    (stop
      ? `A ${stop.category} stop to include on your ${trip.destinationName} itinerary.`
      : "");

  const cityLabel =
    day?.cityName ||
    stop?.metadata?.formattedAddress ||
    trip.destinationName;

  const mapsUrl =
    stop?.metadata?.lat != null && stop?.metadata?.lng != null
      ? `https://www.google.com/maps/search/?api=1&query=${stop.metadata.lat},${stop.metadata.lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${stop?.name ?? ""} ${trip.destinationName}`
        )}`;

  const patchStop = (patch: Partial<Stop>) => {
    if (!stop || !day) return;
    const updated = structuredClone(trip);
    const targetDay = updated.days.find((d) => d.id === day.id);
    const targetStop = targetDay?.stops.find((s) => s.id === stop.id);
    if (!targetStop) return;
    Object.assign(targetStop, patch);
    onUpdate(updated);
  };

  const handleDurationChange = (minutes: number) => {
    setDuration(minutes);
    patchStop({ durationMinutes: minutes });
  };

  const handleToggleLock = () => {
    const next = !locked;
    setLocked(next);
    patchStop({ userLocked: next });
  };

  const handleMoveToDay = (targetDayId: string) => {
    if (!stop || !day || targetDayId === day.id) return;
    const targetDay = trip.days.find((d) => d.id === targetDayId);
    if (!targetDay) return;
    const updated = moveStopBetweenDays(
      trip,
      stop.id,
      day.id,
      targetDayId,
      targetDay.stops.length
    );
    onUpdate(updated);
  };

  const loadAlternatives = async (query?: string) => {
    if (!stop) return;
    const isSearch = Boolean(query?.trim());
    if (isSearch) setSearchingSwap(true);
    else setLoadingAlts(true);
    try {
      const res = await fetch("/api/ai/replace-stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination: day?.cityName || trip.destinationName,
          stopName: stop.name,
          category: stop.category,
          interests: trip.preferences.interests,
          destinationLat: stop.metadata?.lat ?? trip.destinationLat,
          destinationLng: stop.metadata?.lng ?? trip.destinationLng,
          ...(query?.trim() ? { query: query.trim() } : {}),
        }),
      });
      const data = await res.json();
      setAlternatives(data.alternatives ?? []);
      setAltsLoaded(true);
    } finally {
      setLoadingAlts(false);
      setSearchingSwap(false);
    }
  };

  const applyAlternative = (alt: Alt) => {
    if (!stop || !day) return;
    const updated = structuredClone(trip);
    const targetDay = updated.days.find((d) => d.id === day.id);
    const targetStop = targetDay?.stops.find((s) => s.id === stop.id);
    if (targetStop) {
      targetStop.name = alt.name;
      targetStop.category = alt.category;
      targetStop.durationMinutes = alt.durationMinutes;
      if (alt.placeId) targetStop.placeId = alt.placeId;
      if (alt.metadata) targetStop.metadata = alt.metadata;
    }
    onUpdate(updated);
    onClose();
  };

  return (
    <AnimatePresence>
      {open && stop && day && (
        <motion.div
          key={`backdrop-${stop.id}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}
      {open && stop && day && (
        <motion.aside
          key={`panel-${stop.id}`}
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", stiffness: 400, damping: 35 }}
          className="glass-panel fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-border/80 shadow-glass"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border/80 px-5 py-4">
            <div className="min-w-0">
              <h2 className="font-display text-base font-semibold leading-snug text-card-fg">
                {stop.name}
                {cityLabel ? `, ${cityLabel.replace(/^.*,\s*/, "")}` : ""}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 hover:bg-black/5 dark:hover:bg-white/10"
              aria-label="Close stop details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            data-stop-panel-scroll
            className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain p-5"
          >
            <div className="relative h-40 overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800">
              {stop.metadata?.photoUrl ? (
                <Image
                  src={stop.metadata.photoUrl}
                  alt={stop.name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl">
                  {getCategoryIcon(stop.category)}
                </div>
              )}
            </div>

            <p className="text-sm leading-relaxed text-muted">{description}</p>

            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium capitalize text-accent">
                {stop.category}
              </span>
              {stop.metadata?.rating != null && (
                <span className="flex items-center gap-1 rounded-full bg-stone-100 px-2.5 py-1 text-xs dark:bg-stone-800">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {stop.metadata.rating}
                </span>
              )}
              {priceLabel && (
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs dark:bg-stone-800">
                  {priceLabel}
                </span>
              )}
              {stopCostGbp > 0 && (
                <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs tabular-nums dark:bg-stone-800">
                  ~{formatGbpInr(stopCostGbp, gbpToInr)}
                </span>
              )}
              <span
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium",
                  hoursStatus === "open" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
                  hoursStatus === "closed" && "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
                  hoursStatus === "opens-later" && "bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
                  hoursStatus === "unknown" && "bg-stone-100 text-stone-600 dark:bg-stone-800"
                )}
              >
                {hoursStatus === "open"
                  ? "Open"
                  : hoursStatus === "closed"
                    ? "Closed"
                    : hoursStatus === "opens-later"
                      ? "Opens later"
                      : "Hours unknown"}
              </span>
            </div>

            {stop.metadata?.formattedAddress && (
              <div className="flex items-start gap-2 text-sm text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {stop.metadata.formattedAddress}
              </div>
            )}

            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">Duration</span>
                <span className="text-sm font-medium text-accent">
                  {formatDurationLabel(duration)}
                </span>
              </div>
              <Slider
                value={[duration]}
                onValueChange={([v]) => handleDurationChange(v)}
                min={15}
                max={240}
                step={15}
                labels={["15 min", "4h"]}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <span className="text-sm font-medium text-foreground">Lock position</span>
              <button
                type="button"
                onClick={handleToggleLock}
                className={cn(
                  "rounded-lg p-2 transition-colors",
                  locked
                    ? "bg-accent/15 text-accent"
                    : "text-muted hover:bg-accent/10 hover:text-foreground"
                )}
                aria-label={locked ? "Unlock position" : "Lock position"}
                aria-pressed={locked}
              >
                {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
              </button>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-foreground">Move to day</p>
              <div className="flex flex-wrap gap-2">
                {trip.days.map((d) => {
                  const active = d.id === day.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => handleMoveToDay(d.id)}
                      className={cn(
                        "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                        active
                          ? "bg-accent text-white"
                          : "bg-stone-100 text-muted hover:bg-accent/10 hover:text-foreground dark:bg-stone-800"
                      )}
                    >
                      Day {d.dayIndex + 1}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Swap this stop */}
            <div className="glass-inset space-y-4 rounded-2xl p-4">
              <div className="flex items-start gap-2">
                <ArrowLeftRight className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Swap this stop</h3>
                  <p className="mt-1 text-xs leading-relaxed text-muted">
                    Don&apos;t want to visit {stop.name}? Search for somewhere else or pick a
                    nearby alternative.
                  </p>
                </div>
              </div>

              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  void loadAlternatives(swapQuery);
                }}
              >
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <input
                  value={swapQuery}
                  onChange={(e) => setSwapQuery(e.target.value)}
                  placeholder='Search e.g. "beach club" or "art gallery"'
                  className="glass-inset h-11 w-full rounded-xl pl-10 pr-4 text-sm text-card-fg placeholder:text-card-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
              </form>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">Nearby alternatives</p>
                  <button
                    type="button"
                    onClick={() => loadAlternatives()}
                    disabled={loadingAlts || searchingSwap}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-50"
                  >
                    <RefreshCw
                      className={cn(
                        "h-3.5 w-3.5",
                        (loadingAlts || searchingSwap) && "animate-spin"
                      )}
                    />
                    Refresh
                  </button>
                </div>

                {(loadingAlts || searchingSwap) && (
                  <p className="text-sm text-muted">Finding alternatives…</p>
                )}
                {altsLoaded && !loadingAlts && !searchingSwap && alternatives.length === 0 && (
                  <p className="text-sm text-muted">No alternatives found nearby.</p>
                )}
                <div className="space-y-2">
                  {alternatives.map((alt, index) => (
                    <button
                      key={`alt-${index}-${alt.name}`}
                      type="button"
                      onClick={() => applyAlternative(alt)}
                      className="glass-card flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors hover:ring-1 hover:ring-accent/40"
                    >
                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-stone-100 dark:bg-stone-800">
                        {alt.metadata?.photoUrl ? (
                          <Image
                            src={alt.metadata.photoUrl}
                            alt={alt.name}
                            fill
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-lg">
                            {getCategoryIcon(alt.category)}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{alt.name}</p>
                        <p className="text-xs capitalize text-muted">{alt.category}</p>
                        <PlaceMeta
                          className="mt-1"
                          rating={alt.metadata?.rating}
                          priceLevel={alt.metadata?.priceLevel}
                          estimatedCostGbp={
                            alt.metadata?.estimatedCostGbp ??
                            (alt.metadata?.priceLevel != null
                              ? costGbpFromPriceLevel(alt.metadata.priceLevel)
                              : undefined)
                          }
                          gbpToInr={gbpToInr}
                        />
                      </div>
                      <span className="shrink-0 text-xs text-muted">
                        {formatDurationLabel(alt.durationMinutes)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <Button asChild type="button" variant="secondary" className="w-full">
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" />
                  Open in Google Maps
                </a>
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30"
                onClick={() => onRemove(day.id, stop.id)}
              >
                <Trash2 className="h-4 w-4" />
                Remove stop
              </Button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
