"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { hydrateAccountTrips } from "@/lib/sync/cloud";
import type { Trip } from "@/lib/types/trip";

interface HomeTripsLoaderProps {
  onTrips: (trips: Trip[]) => void;
}

/** After sign-in: merge guest trips + pull account trips into IndexedDB. */
export default function HomeTripsLoader({ onTrips }: HomeTripsLoaderProps) {
  const { isSignedIn, userId } = useAuth();
  const lastUser = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userId) {
      lastUser.current = null;
      return;
    }
    if (lastUser.current === userId) return;
    lastUser.current = userId;

    void hydrateAccountTrips(userId)
      .then(onTrips)
      .catch((err) => console.error("Failed to load account trips", err));
  }, [isSignedIn, userId, onTrips]);

  return null;
}
