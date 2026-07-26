import type { Trip } from "@/lib/types/trip";

export async function syncTripToCloud(trip: Trip, _userId?: string): Promise<Trip> {
  const res = await fetch("/api/trips", {
    method: trip.userId ? "PUT" : "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(trip),
  });

  if (!res.ok) throw new Error("Sync failed");
  const data = await res.json();
  return data.trip;
}

export async function fetchCloudTrips(_userId?: string): Promise<Trip[]> {
  const res = await fetch("/api/trips", {
    credentials: "same-origin",
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

/** Push guest trips up, then pull all account trips into IndexedDB. */
export async function hydrateAccountTrips(userId: string): Promise<Trip[]> {
  const { getAllTrips, saveTrip } = await import("@/lib/db/local");
  const local = await getAllTrips();
  const guest = local.filter((t) => !t.userId);

  if (guest.length > 0) {
    const uploaded = await mergeLocalTripsToCloud(guest, userId);
    for (const trip of uploaded) {
      await saveTrip(trip);
    }
  }

  // Also push any already-owned local trips that may be newer
  const owned = (await getAllTrips()).filter((t) => t.userId === userId);
  for (const trip of owned) {
    try {
      const synced = await syncTripToCloud(trip, userId);
      await saveTrip(synced);
    } catch {
      // keep local copy if sync fails
    }
  }

  const cloud = await fetchCloudTrips(userId);
  for (const trip of cloud) {
    await saveTrip(trip);
  }
  return getAllTrips();
}
