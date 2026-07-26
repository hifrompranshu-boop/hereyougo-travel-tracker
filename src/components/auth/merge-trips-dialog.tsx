"use client";

import dynamic from "next/dynamic";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { mergeLocalTripsToCloud } from "@/lib/sync/cloud";
import type { Trip } from "@/lib/types/trip";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const SignInButton = clerkKey
  ? dynamic(
      () => import("@clerk/nextjs").then((m) => m.SignInButton),
      { ssr: false }
    )
  : null;

interface MergeTripsDialogProps {
  localTrips: Trip[];
  onClose: () => void;
  onMerged: () => void;
}

export function MergeTripsDialog({ localTrips, onClose }: MergeTripsDialogProps) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent title="Sync your trips">
        <p className="mt-2 text-sm text-stone-500">
          Merge {localTrips.length} local trip{localTrips.length !== 1 ? "s" : ""} into your account?
        </p>
        <ul className="mt-4 space-y-2">
          {localTrips.map((t) => (
            <li
              key={t.id}
              className="rounded-lg bg-stone-50 px-3 py-2 text-sm dark:bg-stone-900"
            >
              {t.title} — {t.destinationName}
            </li>
          ))}
        </ul>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Not now
          </Button>
          {SignInButton ? (
            <SignInButton mode="modal">
              <Button className="flex-1">Sign in & merge</Button>
            </SignInButton>
          ) : (
            <Button onClick={onClose} className="flex-1">
              Continue as guest
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export async function mergeTripsAfterSignIn(userId: string): Promise<void> {
  const { getAllTrips, saveTrip: persist } = await import("@/lib/db/local");
  const localTrips = await getAllTrips();
  const guestTrips = localTrips.filter((t) => !t.userId);

  if (guestTrips.length === 0) return;

  const merged = await mergeLocalTripsToCloud(guestTrips, userId);
  for (const trip of merged) {
    await persist(trip);
  }
}
