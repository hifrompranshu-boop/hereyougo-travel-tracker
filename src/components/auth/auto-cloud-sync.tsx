"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import { saveTrip } from "@/lib/db/local";
import { syncTripToCloud } from "@/lib/sync/cloud";
import type { Trip } from "@/lib/types/trip";

interface AutoCloudSyncProps {
  trip: Trip;
  onSynced?: (trip: Trip) => void;
}

/** Debounced cloud save while signed in — survives logout/login on this server. */
export default function AutoCloudSync({ trip, onSynced }: AutoCloudSyncProps) {
  const { isSignedIn, userId } = useAuth();
  const lastKey = useRef<string>("");

  useEffect(() => {
    if (!isSignedIn || !userId) return;

    const key = `${trip.id}:${trip.updatedAt}:${trip.days.length}`;
    if (lastKey.current === key) return;

    const timer = setTimeout(() => {
      void (async () => {
        try {
          const synced = await syncTripToCloud({ ...trip, userId }, userId);
          lastKey.current = `${synced.id}:${synced.updatedAt}:${synced.days.length}`;
          await saveTrip(synced);
          if (
            synced.userId !== trip.userId ||
            synced.updatedAt !== trip.updatedAt
          ) {
            onSynced?.(synced);
          }
        } catch (err) {
          console.error("Cloud sync failed", err);
        }
      })();
    }, 700);

    return () => clearTimeout(timer);
  }, [trip, isSignedIn, userId, onSynced]);

  return null;
}
