"use client";

import {
  CALENDAR_GUTTER_PX,
  HOUR_HEIGHT_PX,
  formatHourLabel,
  type CalendarWindow,
} from "@/lib/time/calendar-layout";
import { cn } from "@/lib/utils";

interface TimeGutterProps {
  window: CalendarWindow;
  /** Sticky header height to offset under day headers */
  headerOffset?: number;
  className?: string;
  nowOffset?: number | null;
}

export function TimeGutter({
  window,
  headerOffset = 0,
  className,
  nowOffset,
}: TimeGutterProps) {
  return (
    <div
      className={cn("relative shrink-0 select-none", className)}
      style={{ width: CALENDAR_GUTTER_PX }}
    >
      <div style={{ height: headerOffset }} />
      <div className="relative" style={{ height: window.totalHeight }}>
        {window.hours.map((m) => (
          <div
            key={m}
            className="absolute right-2 -translate-y-1/2 text-[10px] font-medium uppercase tracking-wide text-muted"
            style={{ top: ((m - window.startMinutes) / 60) * HOUR_HEIGHT_PX }}
          >
            {formatHourLabel(m)}
          </div>
        ))}
        {nowOffset != null && nowOffset >= 0 && nowOffset <= window.totalHeight && (
          <div
            className="absolute right-0 left-1 z-20 flex items-center"
            style={{ top: nowOffset }}
          >
            <span className="rounded-full bg-violet-500 px-1.5 py-0.5 text-[9px] font-semibold text-white shadow-sm">
              Now
            </span>
            <div className="h-px flex-1 bg-violet-500" />
          </div>
        )}
      </div>
    </div>
  );
}
