"use client";

import Link from "next/link";
import Image from "next/image";
import { format, parseISO } from "date-fns";
import { Calendar, MapPin } from "lucide-react";
import type { Trip } from "@/lib/types/trip";
import { cn } from "@/lib/utils";

interface TripCardProps {
  trip: Trip;
  className?: string;
}

export function TripCard({ trip, className }: TripCardProps) {
  const stopCount = trip.days.reduce((n, d) => n + d.stops.length, 0);

  return (
    <Link
      href={`/trip/${trip.id}`}
      className={cn(
        "glass-card glass-card-accent group block overflow-hidden rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-glass",
        className
      )}
    >
      <div className="relative h-40 bg-stone-100 dark:bg-stone-800">
        {trip.coverPhotoUrl ? (
          <Image
            src={trip.coverPhotoUrl}
            alt={trip.destinationName}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-accent/20 via-transparent to-sky-400/15">
            <MapPin className="h-10 w-10 text-accent/50" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/15 to-transparent" />
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="font-display text-lg font-semibold text-white drop-shadow-sm">
            {trip.title}
          </h3>
        </div>
      </div>
      <div className="relative z-[1] space-y-2 p-4">
        <div className="flex items-center gap-2 text-sm text-card-muted">
          <MapPin className="h-3.5 w-3.5" />
          {trip.destinationName}
        </div>
        <div className="flex items-center gap-2 text-sm text-card-muted">
          <Calendar className="h-3.5 w-3.5" />
          {format(parseISO(trip.startDate), "MMM d")} · {trip.numDays} days · {stopCount} stops
        </div>
        <p className="text-xs capitalize text-card-muted/80">
          {trip.preferences.pace} pace · {trip.status}
        </p>
      </div>
    </Link>
  );
}
