"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Plus, Compass } from "lucide-react";
import { Header } from "@/components/layout/header";
import { TripCard } from "@/components/trip/trip-card";
import { Button } from "@/components/ui/button";
import { getAllTrips } from "@/lib/db/local";
import type { Trip } from "@/lib/types/trip";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const HomeTripsLoader = clerkKey
  ? dynamic(() => import("@/components/auth/home-trips-loader"), { ssr: false })
  : null;

export default function HomePage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshTrips = useCallback((next: Trip[]) => {
    setTrips(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    getAllTrips().then((t) => {
      setTrips(t);
      setLoading(false);
    });
  }, []);

  return (
    <>
      <Header />
      {HomeTripsLoader && <HomeTripsLoader onTrips={refreshTrips} />}
      <main className="flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground">
                My trips
              </h1>
              <p className="mt-2 text-muted">
                Plan, organize, and optimize your adventures
                {clerkKey
                  ? " — sign up or log in to keep trips in your account"
                  : ""}
              </p>
            </div>
            <Button asChild size="lg">
              <Link href="/trip/new">
                <Plus className="h-5 w-5" />
                Plan a trip
              </Link>
            </Button>
          </div>

          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="glass-card h-64 animate-pulse rounded-2xl"
                />
              ))}
            </div>
          ) : trips.length === 0 ? (
            <div className="glass-card flex flex-col items-center justify-center rounded-2xl border-dashed py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                <Compass className="h-8 w-8 text-accent" />
              </div>
              <h2 className="font-display mt-6 text-xl font-semibold text-card-fg">
                No trips yet
              </h2>
              <p className="mt-2 max-w-sm text-center text-card-muted">
                Create your first AI-powered itinerary in under two minutes
              </p>
              <Button asChild size="lg" className="mt-8">
                <Link href="/trip/new">
                  <Plus className="h-5 w-5" />
                  Plan a trip
                </Link>
              </Button>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {trips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
