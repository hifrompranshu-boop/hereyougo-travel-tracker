"use client";

import { useEffect, useState } from "react";
import { SignInButton, useAuth, useUser } from "@clerk/nextjs";
import { Cloud } from "lucide-react";
import { MergeTripsDialog } from "@/components/auth/merge-trips-dialog";
import { getAllTrips } from "@/lib/db/local";
import type { Trip } from "@/lib/types/trip";

interface SyncBannerInnerProps {
  trip: Trip;
  onSync: (userId: string) => void;
}

export default function SyncBannerInner({ trip, onSync }: SyncBannerInnerProps) {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [showMerge, setShowMerge] = useState(false);
  const [localTrips, setLocalTrips] = useState<Trip[]>([]);

  useEffect(() => {
    if (isSignedIn && user?.id && !trip.userId) {
      onSync(user.id);
    }
  }, [isSignedIn, user?.id, trip.userId, onSync]);

  if (trip.userId) return null;

  return (
    <>
      <div className="border-b border-accent/20 bg-accent/5 px-4 py-2.5 text-center text-sm text-stone-600 dark:text-stone-400">
        <Cloud className="mr-1.5 inline h-4 w-4 text-accent" />
        Trip saved locally.{" "}
        {!isSignedIn ? (
          <SignInButton mode="modal">
            <button type="button" className="font-medium text-accent hover:underline">
              Sign in to sync across devices
            </button>
          </SignInButton>
        ) : (
          <button
            type="button"
            className="font-medium text-accent hover:underline"
            onClick={async () => {
              const trips = await getAllTrips();
              setLocalTrips(trips);
              setShowMerge(true);
            }}
          >
            Sync now
          </button>
        )}
      </div>
      {showMerge && (
        <MergeTripsDialog
          localTrips={localTrips}
          onClose={() => setShowMerge(false)}
          onMerged={() => setShowMerge(false)}
        />
      )}
    </>
  );
}
