import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { Trip } from "@/lib/types/trip";

const DATA_DIR = path.join(process.cwd(), ".data");
const SHARED_FILE = path.join(DATA_DIR, "shared.json");

async function readShared(): Promise<Record<string, Trip>> {
  try {
    const raw = await fs.readFile(SHARED_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const trip: Trip = await request.json();
  const shareId = trip.shareId ?? crypto.randomUUID().slice(0, 8);

  const shared = await readShared();
  const sharedTrip = { ...trip, shareId };
  shared[trip.id] = sharedTrip;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(SHARED_FILE, JSON.stringify(shared, null, 2));

  return NextResponse.json({ shareId, url: `/share/${shareId}` });
}
