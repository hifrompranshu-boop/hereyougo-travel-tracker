import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Trip } from "@/lib/types/trip";

const DATA_DIR = path.join(process.cwd(), ".data");
const TRIPS_FILE = path.join(DATA_DIR, "trips.json");

async function ensureDataDir() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

async function readTrips(): Promise<Record<string, Trip>> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(TRIPS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function writeTrips(trips: Record<string, Trip>) {
  await ensureDataDir();
  await fs.writeFile(TRIPS_FILE, JSON.stringify(trips, null, 2));
}

async function requireUserId(): Promise<string | null> {
  if (
    !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    !process.env.CLERK_SECRET_KEY
  ) {
    return null;
  }
  const { userId } = await auth();
  return userId;
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await readTrips();
  const userTrips = Object.values(trips).filter((t) => t.userId === userId);
  return NextResponse.json({ trips: userTrips });
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip: Trip = await request.json();
  trip.userId = userId;
  trip.updatedAt = new Date().toISOString();

  const trips = await readTrips();
  trips[trip.id] = trip;
  await writeTrips(trips);

  return NextResponse.json({ trip });
}

export async function PUT(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trip: Trip = await request.json();
  const trips = await readTrips();
  const existing = trips[trip.id];

  if (existing && existing.userId && existing.userId !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  trip.userId = userId;
  trip.updatedAt = new Date().toISOString();
  trips[trip.id] = trip;
  await writeTrips(trips);

  return NextResponse.json({ trip });
}

export async function DELETE(request: NextRequest) {
  const userId = await requireUserId();
  const tripId = request.nextUrl.searchParams.get("id");

  if (!userId || !tripId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await readTrips();
  if (trips[tripId]?.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  delete trips[tripId];
  await writeTrips(trips);
  return NextResponse.json({ ok: true });
}
