import type { Trip } from "@/lib/types/trip";

export async function syncTripToCloud(trip: Trip, userId: string): Promise<Trip> {
  const res = await fetch("/api/trips", {
    method: trip.userId ? "PUT" : "POST",
    headers: {
      "Content-Type": "application/json",
      "x-user-id": userId,
    },
    body: JSON.stringify({ ...trip, userId }),
  });

  if (!res.ok) throw new Error("Sync failed");
  const data = await res.json();
  return data.trip;
}

export async function fetchCloudTrips(userId: string): Promise<Trip[]> {
  const res = await fetch("/api/trips", {
    headers: { "x-user-id": userId },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data.trips ?? [];
}

export async function mergeLocalTripsToCloud(
  localTrips: Trip[],
  userId: string
): Promise<Trip[]> {
  const merged: Trip[] = [];
  for (const trip of localTrips) {
    const synced = await syncTripToCloud({ ...trip, userId }, userId);
    merged.push(synced);
  }
  return merged;
}

export async function createShareLink(trip: Trip): Promise<string> {
  const res = await fetch("/api/trips/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trip),
  });
  if (!res.ok) throw new Error("Share failed");
  const data = await res.json();
  return data.url;
}
