import { NextRequest, NextResponse } from "next/server";
import { getDirections } from "@/lib/places/google";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { origin, destination, mode = "walking" } = body;

    if (!origin?.lat || !destination?.lat) {
      return NextResponse.json({ error: "Origin and destination required" }, { status: 400 });
    }

    const result = await getDirections(origin, destination, mode);
    if (!result) {
      return NextResponse.json({ error: "No route found" }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Directions error:", error);
    return NextResponse.json({ error: "Directions failed" }, { status: 500 });
  }
}
