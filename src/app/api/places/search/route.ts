import { NextRequest, NextResponse } from "next/server";
import { searchPlaces } from "@/lib/places/google";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q");
  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");

  if (!query) {
    return NextResponse.json({ error: "Query required" }, { status: 400 });
  }

  const location =
    lat && lng ? { lat: parseFloat(lat), lng: parseFloat(lng) } : undefined;

  try {
    const places = await searchPlaces(query, location);
    return NextResponse.json({ places });
  } catch (error) {
    console.error("Places search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
