import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { Trip } from "@/lib/types/trip";

const SHARED_FILE = path.join(process.cwd(), ".data", "shared.json");

async function readShared(): Promise<Record<string, Trip>> {
  try {
    const raw = await fs.readFile(SHARED_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  const { shareId } = await params;
  const shared = await readShared();
  const trip = Object.values(shared).find((t) => t.shareId === shareId);

  if (!trip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ trip });
}
