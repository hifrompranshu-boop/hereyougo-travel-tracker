"use client";

import dynamic from "next/dynamic";
import { Cloud } from "lucide-react";
import { MergeTripsDialog } from "@/components/auth/merge-trips-dialog";
import { getAllTrips } from "@/lib/db/local";
import type { Trip } from "@/lib/types/trip";
import { useState } from "react";

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

const SyncBannerInner = clerkKey
  ? dynamic(() => import("@/components/auth/sync-banner-inner"), { ssr: false })
  : null;

interface SyncBannerProps {
  trip: Trip;
  onSync: (userId: string) => void;
}

export function SyncBanner(props: SyncBannerProps) {
  if (!SyncBannerInner) return null;
  return <SyncBannerInner {...props} />;
}
