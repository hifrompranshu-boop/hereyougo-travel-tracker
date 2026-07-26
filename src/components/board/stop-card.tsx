"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { Baby, Info, MapPin, PawPrint, Star } from "lucide-react";
import Image from "next/image";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getCategoryStyle } from "@/lib/places/category-style";
import { estimateStopCostGbp, formatGbp } from "@/lib/export/budget";
import { formatPriceLevel } from "@/lib/time/hours";
import { formatTimeRange, MIN_EVENT_HEIGHT_PX } from "@/lib/time/calendar-layout";
import {
  getStopConsiderations,
  shouldShowInfoButton,
  type StopConsideration,
} from "@/lib/trip/party-compat";
import type { Stop } from "@/lib/types/trip";
import { getStopHoursStatus } from "@/lib/time/engine";
import { cn } from "@/lib/utils";

interface StopCardProps {
  stop: Stop;
  date: string;
  gbpToInr?: number | null;
  party?: { adults: number; children: number; pets: number };
  isDragging?: boolean;
  isRecalculating?: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
  onSelect?: () => void;
  onMenu?: () => void;
}

function ConsiderationIcon({ kind }: { kind: StopConsideration["kind"] }) {
  if (kind === "pets") return <PawPrint className="h-3.5 w-3.5 text-accent" />;
  if (kind === "children") return <Baby className="h-3.5 w-3.5 text-accent" />;
  return <Info className="h-3.5 w-3.5 text-accent" />;
}

export function StopCard({
  stop,
  date,
  party,
  isDragging,
  isRecalculating,
  compact,
  className,
  style,
  onSelect,
}: StopCardProps) {
  const [infoOpen, setInfoOpen] = useState(false);
  const hoursStatus = getStopHoursStatus(stop, date);
  const costGbp = estimateStopCostGbp(stop);
  const styleCat = getCategoryStyle(stop.category);
  const Icon = styleCat.Icon;
  const photoUrl = stop.metadata?.photoUrl;
  const priceLabel = formatPriceLevel(stop.metadata?.priceLevel);
  const short =
    compact || (style?.height != null && Number(style.height) < MIN_EVENT_HEIGHT_PX);
  const considerations = getStopConsiderations(stop, party, hoursStatus);
  const showInfo = shouldShowInfoButton(stop, party, hoursStatus);

  return (
    <motion.div
      layout={!compact}
      onClick={onSelect}
      style={style}
      className={cn(
        "group relative isolate cursor-pointer overflow-hidden rounded-2xl shadow-glass transition-all duration-200",
        "ring-1 ring-white/10",
        isDragging && "z-20 scale-[1.02] ring-2 ring-accent/50",
        isRecalculating && "animate-pulse",
        !stop.metadata?.verified && "ring-amber-400/60",
        hoursStatus === "closed" && "ring-red-400/50",
        className
      )}
    >
      <div className="absolute inset-0">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt=""
            fill
            className="object-cover"
            unoptimized
            sizes="280px"
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-br from-stone-700 to-stone-900" />
        )}
      </div>

      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-90",
          styleCat.overlay
        )}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-black/10" />

      <div
        className={cn(
          "relative z-[1] flex h-full flex-col text-white",
          short ? "gap-1 p-2.5" : "gap-2 p-3.5"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl backdrop-blur-md",
              styleCat.accent,
              short ? "h-8 w-8" : "h-9 w-9"
            )}
          >
            <Icon className={short ? "h-3.5 w-3.5" : "h-4 w-4"} />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showInfo && (
              <Popover open={infoOpen} onOpenChange={setInfoOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    aria-label={`Info about ${stop.name}`}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                    className="info-glow flex h-6 w-6 items-center justify-center rounded-full bg-accent/90 text-white ring-2 ring-accent/40"
                  >
                    <Info className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  side="left"
                  align="start"
                  onOpenAutoFocus={(e) => e.preventDefault()}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  className="max-h-72 overflow-y-auto"
                >
                  <p className="font-display text-sm font-semibold text-card-fg">
                    {stop.name}
                  </p>
                  <p className="mt-0.5 text-[11px] capitalize text-card-muted">
                    {stop.category}
                    {party && party.pets + party.children > 0
                      ? ` · party ${party.adults}A${party.children ? ` ${party.children}C` : ""}${party.pets ? ` ${party.pets}P` : ""}`
                      : ""}
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {considerations.map((c) => (
                      <li
                        key={`${c.kind}-${c.title}`}
                        className="flex gap-2 rounded-lg bg-accent/5 px-2.5 py-2"
                      >
                        <span className="mt-0.5 shrink-0">
                          <ConsiderationIcon kind={c.kind} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-card-fg">{c.title}</p>
                          <p className="mt-0.5 text-xs leading-relaxed text-card-muted">
                            {c.message}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {stop.metadata?.formattedAddress && (
                    <p className="mt-3 flex items-start gap-1.5 border-t border-border pt-2 text-[11px] text-card-muted">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {stop.metadata.formattedAddress}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            )}
            {stop.metadata?.rating != null && !short && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
                {stop.metadata.rating.toFixed(1)}
              </span>
            )}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <h4
            className={cn(
              "font-semibold leading-snug text-white drop-shadow-sm",
              short ? "line-clamp-2 text-xs" : "line-clamp-2 text-sm"
            )}
          >
            {stop.name}
          </h4>
          <p
            className={cn(
              "mt-0.5 tabular-nums text-white/75",
              short ? "text-[10px]" : "text-xs"
            )}
          >
            {formatTimeRange(stop.scheduledStart, stop.scheduledEnd)}
          </p>
        </div>

        {!short && (
          <div className="mt-auto flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-black/35 px-2 py-0.5 text-[10px] capitalize text-white/90 backdrop-blur-sm">
              <MapPin className="h-2.5 w-2.5" />
              {stop.category}
            </span>
            {priceLabel && (
              <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                {priceLabel}
              </span>
            )}
            {costGbp > 0 && (
              <span className="rounded-full bg-black/35 px-2 py-0.5 text-[10px] tabular-nums text-white/90 backdrop-blur-sm">
                ~{formatGbp(costGbp)}
              </span>
            )}
            {hoursStatus === "closed" && (
              <span className="rounded-full bg-red-500/40 px-2 py-0.5 text-[10px] font-medium backdrop-blur-sm">
                Closed
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export function SortableStopCard(
  props: StopCardProps & {
    id: string;
    calendar?: { top: number; height: number; leftPct: number; widthPct: number };
  }
) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: props.id });

  const { calendar, className, compact, isDragging: dragProp, ...cardProps } = props;

  const style: React.CSSProperties = {
    ...(calendar
      ? {
          position: "absolute" as const,
          top: calendar.top,
          height: calendar.height,
          left: `calc(${calendar.leftPct}% + 4px)`,
          width: `calc(${calendar.widthPct}% - 8px)`,
          zIndex: isDragging ? 30 : 1,
        }
      : {}),
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={calendar ? undefined : "relative"}
      {...attributes}
      {...listeners}
    >
      <StopCard
        {...cardProps}
        style={calendar ? { height: "100%", width: "100%" } : undefined}
        compact={calendar ? calendar.height < MIN_EVENT_HEIGHT_PX : compact}
        isDragging={isDragging || dragProp}
        className={cn(calendar && "h-full w-full", className)}
      />
    </div>
  );
}

export function TravelConnector({
  durationMinutes,
  mode,
}: {
  durationMinutes: number;
  mode: string;
}) {
  const modeIcon = mode === "drive" ? "🚗" : mode === "transit" ? "🚇" : "🚶";
  return (
    <div className="relative flex items-center justify-center py-1">
      <div className="absolute left-1/2 h-full w-0.5 -translate-x-1/2 bg-border" />
      <span className="glass-inset relative z-10 flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] tabular-nums text-card-muted">
        {modeIcon} {durationMinutes}m
      </span>
    </div>
  );
}

export function StopCardOverlay({
  stop,
  date,
  gbpToInr,
  party,
}: {
  stop: Stop;
  date: string;
  gbpToInr?: number | null;
  party?: { adults: number; children: number; pets: number };
}) {
  return (
    <div className="w-[280px]">
      <StopCard
        stop={stop}
        date={date}
        gbpToInr={gbpToInr}
        party={party}
        isDragging
      />
    </div>
  );
}
