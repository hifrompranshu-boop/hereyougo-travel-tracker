import { NextRequest, NextResponse } from "next/server";
import { buildRegenerateDayPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { buildPlacePool, stopsPerDayForPace } from "@/lib/ai/pace";
import { textSearchPlace, placeToStopMetadata } from "@/lib/places/google";
import type { Pace, Stop } from "@/lib/types/trip";

function getOpenRouterKey(): string | undefined {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY
  );
}

function mockStopsForPace(destination: string, dayIndex: number, pace: Pace) {
  const perDay = stopsPerDayForPace(pace);
  const pool = buildPlacePool(destination);
  return Array.from({ length: perDay }, (_, i) => {
    const place = pool[(dayIndex * perDay + i) % pool.length];
    return {
      name: place.name,
      category: place.category,
      durationMinutes: place.durationMinutes,
      dayIndex,
    };
  });
}

async function callAI(prompt: string, destination: string, dayIndex: number, pace: Pace): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    return JSON.stringify({ stops: mockStopsForPace(destination, dayIndex, pace) });
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || "anthropic/claude-3.5-sonnet",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "{}";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      destination,
      dayIndex,
      interests,
      pace = "moderate",
      existingStopNames,
      destinationLat,
      destinationLng,
    } = body;

    const paceValue = (pace as Pace) || "moderate";
    const perDay = stopsPerDayForPace(paceValue);

    const prompt = buildRegenerateDayPrompt(
      destination,
      dayIndex,
      interests ?? [],
      paceValue,
      existingStopNames ?? []
    );
    const content = await callAI(prompt, destination, dayIndex, paceValue);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsedStops = jsonMatch ? (JSON.parse(jsonMatch[0]).stops ?? []) : [];

    if (parsedStops.length < perDay) {
      const pad = mockStopsForPace(destination, dayIndex, paceValue);
      const used = new Set(
        parsedStops.map((s: { name: string }) => s.name.toLowerCase())
      );
      for (const p of pad) {
        if (parsedStops.length >= perDay) break;
        if (used.has(p.name.toLowerCase())) continue;
        parsedStops.push(p);
        used.add(p.name.toLowerCase());
      }
    }
    parsedStops = parsedStops.slice(0, perDay);

    const location =
      destinationLat && destinationLng
        ? { lat: destinationLat, lng: destinationLng }
        : undefined;

    const stops: Stop[] = [];
    for (const [index, aiStop] of parsedStops.entries()) {
      const place = await textSearchPlace(`${aiStop.name} ${destination}`, location);
      stops.push({
        id: crypto.randomUUID(),
        tripDayId: "",
        sortOrder: index,
        placeId: place?.placeId ?? `unverified-${crypto.randomUUID()}`,
        name: place?.name ?? aiStop.name,
        category: aiStop.category,
        scheduledStart: "09:00",
        scheduledEnd: "10:00",
        durationMinutes: aiStop.durationMinutes,
        metadata: place ? placeToStopMetadata(place) : { verified: false },
      });
    }

    return NextResponse.json({ stops });
  } catch (error) {
    console.error("Regenerate day error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
