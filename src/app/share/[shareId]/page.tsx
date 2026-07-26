"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { Header } from "@/components/layout/header";
import { getCategoryIcon } from "@/lib/constants";
import type { Trip } from "@/lib/types/trip";
import { Button } from "@/components/ui/button";

export default function SharePage() {
  const params = useParams();
  const shareId = params.shareId as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/trips/share/${shareId}`)
      .then((r) => r.json())
      .then((data) => {
        setTrip(data.trip ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [shareId]);

  if (loading) {
    return (
      <>
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </>
    );
  }

  if (!trip) {
    return (
      <>
        <Header />
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-stone-500">Trip not found</p>
          <Button asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium text-accent">Shared itinerary</p>
          <h1 className="font-display mt-2 text-3xl font-semibold text-foreground">
            {trip.title}
          </h1>
          <p className="mt-2 text-muted">
            {trip.destinationName} · {format(parseISO(trip.startDate), "MMM d, yyyy")} ·{" "}
            {trip.numDays} days
          </p>
        </div>

        <div className="space-y-8">
          {trip.days.map((day) => (
            <section key={day.id} className="glass-card rounded-2xl p-6">
              <h2 className="font-display relative z-[1] text-lg font-semibold text-card-fg">
                {day.label}
              </h2>
              <div className="relative z-[1] mt-4 space-y-4">
                {day.stops.map((stop) => (
                  <div key={stop.id} className="flex gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 text-lg">
                      {getCategoryIcon(stop.category)}
                    </div>
                    <div>
                      <p className="font-medium text-card-fg">{stop.name}</p>
                      <p className="text-sm tabular-nums text-card-muted">
                        {stop.scheduledStart} – {stop.scheduledEnd} · {stop.durationMinutes}m
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild size="lg">
            <Link href="/trip/new">Plan your own trip</Link>
          </Button>
        </div>
      </main>
    </>
  );
}
