import Dexie, { type EntityTable } from "dexie";
import type { Trip } from "@/lib/types/trip";

export interface SyncQueueItem {
  id: string;
  tripId: string;
  action: "create" | "update" | "delete";
  payload?: Trip;
  createdAt: string;
}

class TripDatabase extends Dexie {
  trips!: EntityTable<Trip, "id">;
  syncQueue!: EntityTable<SyncQueueItem, "id">;

  constructor() {
    super("VoyageDB");
    this.version(1).stores({
      trips: "id, updatedAt, status, destinationName",
      syncQueue: "id, tripId, createdAt",
    });
  }
}

export const db = new TripDatabase();

export async function getAllTrips(): Promise<Trip[]> {
  return db.trips.orderBy("updatedAt").reverse().toArray();
}

export async function getTrip(id: string): Promise<Trip | undefined> {
  return db.trips.get(id);
}

export async function saveTrip(trip: Trip): Promise<void> {
  trip.updatedAt = new Date().toISOString();
  await db.trips.put(trip);
}

export async function deleteTrip(id: string): Promise<void> {
  await db.trips.delete(id);
}

export async function enqueueSync(item: Omit<SyncQueueItem, "id" | "createdAt">): Promise<void> {
  await db.syncQueue.add({
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
}

export async function getSyncQueue(): Promise<SyncQueueItem[]> {
  return db.syncQueue.orderBy("createdAt").toArray();
}

export async function clearSyncQueueItem(id: string): Promise<void> {
  await db.syncQueue.delete(id);
}

export function exportTripJson(trip: Trip): string {
  return JSON.stringify(trip, null, 2);
}
