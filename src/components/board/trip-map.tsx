"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Trip, TripDay, Stop } from "@/lib/types/trip";
import { getCategoryIcon } from "@/lib/constants";

type DayFilter = "all" | number;

interface TripMapProps {
  trip: Trip;
  dayFilter: DayFilter;
  onStopSelect?: (stop: Stop) => void;
}

function categoryColor(category: string): string {
  const c = category.toLowerCase();
  if (/restaurant|cafe|market|food/.test(c)) return "#ea580c";
  if (/museum|culture|art|gallery/.test(c)) return "#7c3aed";
  if (/park|nature|beach/.test(c)) return "#059669";
  if (/night|lounge|bar/.test(c)) return "#db2777";
  return "#0d9488";
}

function makeIcon(label: string, color: string) {
  return L.divIcon({
    className: "",
    iconSize: [32, 40],
    iconAnchor: [16, 40],
    popupAnchor: [0, -36],
    html: `<div style="
      display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));
    ">
      <div style="
        background:${color};color:#fff;width:28px;height:28px;border-radius:999px;
        display:flex;align-items:center;justify-content:center;font:700 12px/1 system-ui,sans-serif;
        border:2px solid #fff;
      ">${label}</div>
      <div style="width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-top:8px solid ${color};margin-top:-1px;"></div>
    </div>`,
  });
}

function FitBounds({
  points,
}: {
  points: Array<[number, number]>;
}) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 13);
      return;
    }
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 14 });
  }, [map, points]);
  return null;
}

export function TripMap({ trip, dayFilter, onStopSelect }: TripMapProps) {
  const days: TripDay[] =
    dayFilter === "all"
      ? trip.days
      : trip.days.filter((d) => d.dayIndex === dayFilter);

  const markers = useMemo(() => {
    const items: Array<{
      stop: Stop;
      day: TripDay;
      index: number;
      position: [number, number];
    }> = [];
    for (const day of days) {
      day.stops.forEach((stop, index) => {
        const lat = stop.metadata?.lat;
        const lng = stop.metadata?.lng;
        if (lat == null || lng == null) return;
        if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return;
        items.push({ stop, day, index, position: [lat, lng] });
      });
    }
    return items;
  }, [days]);

  const polylines = useMemo(() => {
    return days
      .map((day) => {
        const pts = day.stops
          .map((s) => {
            const lat = s.metadata?.lat;
            const lng = s.metadata?.lng;
            if (lat == null || lng == null) return null;
            if (Math.abs(lat) < 0.01 && Math.abs(lng) < 0.01) return null;
            return [lat, lng] as [number, number];
          })
          .filter(Boolean) as Array<[number, number]>;
        return { dayId: day.id, pts };
      })
      .filter((p) => p.pts.length >= 2);
  }, [days]);

  const center: [number, number] = useMemo(() => {
    if (markers.length > 0) return markers[0].position;
    if (trip.destinationLat && trip.destinationLng) {
      return [trip.destinationLat, trip.destinationLng];
    }
    return [48.8566, 2.3522];
  }, [markers, trip.destinationLat, trip.destinationLng]);

  const allPoints = markers.map((m) => m.position);

  if (markers.length === 0) {
    return (
      <div className="glass-card flex h-full min-h-[420px] items-center justify-center rounded-2xl text-sm text-card-muted">
        No mapped locations yet. Stops need coordinates from place search.
      </div>
    );
  }

  return (
    <div className="glass-card h-full min-h-[420px] overflow-hidden rounded-2xl">
      <MapContainer
        center={center}
        zoom={12}
        className="h-[min(70vh,640px)] w-full"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints} />
        {polylines.map((line) => (
          <Polyline
            key={line.dayId}
            positions={line.pts}
            pathOptions={{ color: "#0d9488", weight: 3, opacity: 0.75 }}
          />
        ))}
        {markers.map(({ stop, day, index, position }) => (
          <Marker
            key={`${day.id}-${stop.id}`}
            position={position}
            icon={makeIcon(
              dayFilter === "all" ? String(day.dayIndex + 1) : String(index + 1),
              categoryColor(stop.category)
            )}
            eventHandlers={{
              click: () => onStopSelect?.(stop),
            }}
          >
            <Popup>
              <div className="min-w-[160px] text-sm">
                <p className="font-semibold">
                  {getCategoryIcon(stop.category)} {stop.name}
                </p>
                <p className="mt-1 capitalize text-stone-500">
                  Day {day.dayIndex + 1} · {stop.category}
                </p>
                <p className="tabular-nums text-stone-500">
                  {stop.scheduledStart} – {stop.scheduledEnd}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
