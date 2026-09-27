"use client";

import dynamic from "next/dynamic";
import type { Trip } from "@/lib/types/trip";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const SyncBannerInner = clerkKey
  ? dynamic(() => import("@/components/auth/sync-banner-inner"), { ssr: false })
  : null;

const AutoCloudSync = clerkKey
  ? dynamic(() => import("@/components/auth/auto-cloud-sync"), { ssr: false })
  : null;

interface SyncBannerProps {
  trip: Trip;
  onSync: (userId: string) => void;
  onCloudSynced?: (trip: Trip) => void;
}

export function SyncBanner({ trip, onSync, onCloudSynced }: SyncBannerProps) {
  if (!SyncBannerInner) return null;
  return (
    <>
      {AutoCloudSync && (
        <AutoCloudSync trip={trip} onSynced={onCloudSynced} />
      )}
      <SyncBannerInner trip={trip} onSync={onSync} />
    </>
  );
}
