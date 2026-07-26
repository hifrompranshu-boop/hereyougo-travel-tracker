import { NextRequest, NextResponse } from "next/server";
import { fetchGbpToInrRate } from "@/lib/forex/gbp-inr";

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date") ?? undefined;
  const quote = await fetchGbpToInrRate(date ?? undefined);
  return NextResponse.json(quote, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
