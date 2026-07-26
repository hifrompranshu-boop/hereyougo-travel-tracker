"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PlaceMeta } from "@/components/places/place-meta";
import { costGbpFromPriceLevel } from "@/lib/export/budget";
import { useGbpToInrRate } from "@/hooks/use-gbp-inr-rate";
import type { Stop, Trip } from "@/lib/types/trip";
import {
  rebuildTravelLegs,
  assignTimeSlotsRespectingHours,
} from "@/lib/time/engine";
import { defaultOpeningHours } from "@/lib/time/hours";

interface PlaceResult {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  formattedAddress?: string;
  rating?: number;
  priceLevel?: number;
  estimatedCostGbp?: number;
  photoUrl?: string;
}

interface AddStopDialogProps {
  destination: string;
  destinationLat?: number;
  destinationLng?: number;
  dayId: string;
  trip: Trip;
  onClose: () => void;
  onAdd: (trip: Trip) => void;
}

export function AddStopDialog({
  destination,
  destinationLat,
  destinationLng,
  dayId,
  trip,
  onClose,
  onAdd,
}: AddStopDialogProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const { rate: gbpToInr } = useGbpToInrRate();

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const params = new URLSearchParams({ q: `${query} ${destination}` });
      if (destinationLat) params.set("lat", String(destinationLat));
      if (destinationLng) params.set("lng", String(destinationLng));
      const res = await fetch(`/api/places/search?${params}`);
      const data = await res.json();
      setResults(
        (data.places ?? []).map((p: Record<string, unknown>) => {
          const priceLevel = p.priceLevel as number | undefined;
          return {
            placeId: p.placeId as string,
            name: p.name as string,
            lat: p.lat as number,
            lng: p.lng as number,
            formattedAddress: p.formattedAddress as string | undefined,
            rating: p.rating as number | undefined,
            priceLevel,
            estimatedCostGbp:
              (p.estimatedCostGbp as number | undefined) ??
              (priceLevel != null ? costGbpFromPriceLevel(priceLevel) : undefined),
            photoUrl: (p.photos as Array<{ url?: string }>)?.[0]?.url,
          };
        })
      );
    } finally {
      setSearching(false);
    }
  };

  const addPlace = (place: PlaceResult) => {
    const updated = structuredClone(trip);
    const day = updated.days.find((d) => d.id === dayId);
    if (!day) return;

    const priceLevel = place.priceLevel ?? 2;
    const newStop: Stop = {
      id: crypto.randomUUID(),
      tripDayId: dayId,
      sortOrder: day.stops.length,
      placeId: place.placeId,
      name: place.name,
      category: "landmark",
      scheduledStart: "09:00",
      scheduledEnd: "10:00",
      durationMinutes: 90,
      metadata: {
        lat: place.lat,
        lng: place.lng,
        formattedAddress: place.formattedAddress,
        rating: place.rating,
        priceLevel,
        estimatedCostGbp:
          place.estimatedCostGbp ?? costGbpFromPriceLevel(priceLevel),
        photoUrl: place.photoUrl,
        verified: true,
        openingHours: defaultOpeningHours(),
      },
    };

    day.stops.push(newStop);
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

    onAdd(updated);
    onClose();
  };

  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent title="Add a stop">
        <div className="mt-4 space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && search()}
                placeholder="Search places..."
                className="glass-inset h-10 w-full rounded-xl pl-10 pr-4 text-sm text-card-fg placeholder:text-card-muted"
              />
            </div>
            <Button onClick={search} disabled={searching}>
              Search
            </Button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {results.map((place) => (
              <button
                key={place.placeId}
                onClick={() => addPlace(place)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{place.name}</p>
                  {place.formattedAddress && (
                    <p className="text-xs text-stone-500">{place.formattedAddress}</p>
                  )}
                  <PlaceMeta
                    className="mt-1"
                    rating={place.rating}
                    priceLevel={place.priceLevel}
                    estimatedCostGbp={place.estimatedCostGbp}
                    gbpToInr={gbpToInr}
                  />
                </div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
