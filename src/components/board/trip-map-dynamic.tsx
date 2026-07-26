"use client";

import dynamic from "next/dynamic";
import type { Trip, Stop } from "@/lib/types/trip";

const TripMap = dynamic(
  () => import("@/components/board/trip-map").then((m) => m.TripMap),
  {
    ssr: false,
    loading: () => (
      <div className="glass-card flex h-[min(70vh,640px)] items-center justify-center rounded-2xl text-sm text-card-muted">
        Loading map…
      </div>
    ),
  }
);

export function TripMapDynamic(props: {
  trip: Trip;
  dayFilter: "all" | number;
  onStopSelect?: (stop: Stop) => void;
}) {
  return <TripMap {...props} />;
}
