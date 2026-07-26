import { NextRequest, NextResponse } from "next/server";
import { buildItineraryPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import {
  buildPlacePool,
  ensureMealStopsForDay,
  stopsPerDayForPace,
} from "@/lib/ai/pace";
import { textSearchPlace, placeToStopMetadata } from "@/lib/places/google";
import { DEFAULT_BUDGET_BY_TIER } from "@/lib/export/budget";
import { deriveWizardMeta, emptyCity } from "@/lib/trip/cities";
import { buildTripFromAI } from "@/lib/trip/builder";
import type {
  AIGeneratedItinerary,
  AIGeneratedStop,
  Pace,
  Stop,
  WizardCity,
  WizardFormData,
} from "@/lib/types/trip";

function getOpenRouterKey(): string | undefined {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY
  );
}

function getModel(): string {
  return (
    process.env.OPENROUTER_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    "anthropic/claude-3.5-sonnet"
  );
}

function normalizeFormData(raw: WizardFormData): WizardFormData {
  let cities: WizardCity[] = raw.cities?.length
    ? raw.cities
    : [
        emptyCity({
          name: raw.destinationName,
          placeId: raw.destinationPlaceId,
          lat: raw.destinationLat,
          lng: raw.destinationLng,
          arrivalDate: raw.startDate,
          arrivalTime: raw.dayStartTime || "10:00",
          numDays: raw.numDays || 3,
        }),
      ];

  const meta = deriveWizardMeta(cities);
  const budget = raw.budget ?? "mid";
  return {
    ...raw,
    cities,
    ...meta,
    budget,
    defaultBudgetPerDay:
      typeof raw.defaultBudgetPerDay === "number" && raw.defaultBudgetPerDay > 0
        ? raw.defaultBudgetPerDay
        : DEFAULT_BUDGET_BY_TIER[budget],
    dayStartTime: raw.dayStartTime || meta.dayStartTime,
    dayEndTime: raw.dayEndTime || "21:00",
    adults: raw.adults ?? 2,
    children: raw.children ?? 0,
    pets: raw.pets ?? 0,
  };
}

function generateMockForCity(
  destination: string,
  numDays: number,
  pace: Pace,
  dayIndexOffset: number
): AIGeneratedItinerary["days"] {
  const perDay = stopsPerDayForPace(pace);
  const pool = buildPlacePool(destination);
  return Array.from({ length: numDays }, (_, localDay) => {
    const dayIndex = dayIndexOffset + localDay;
    const stops: AIGeneratedStop[] = [];
    for (let i = 0; i < perDay; i++) {
      const place = pool[(localDay * perDay + i) % pool.length];
      const wrap = Math.floor((localDay * perDay + i) / pool.length);
      stops.push({
        name: wrap > 0 ? `${place.name} (${wrap + 1})` : place.name,
        category: place.category,
        durationMinutes: place.durationMinutes,
        dayIndex,
      });
    }
    return {
      dayIndex,
      stops: ensureMealStopsForDay(stops, dayIndex, destination),
    };
  });
}

function generateMockItinerary(formData: WizardFormData): AIGeneratedItinerary {
  const cities = formData.cities;
  let offset = 0;
  const days: AIGeneratedItinerary["days"] = [];
  for (const city of cities) {
    days.push(
      ...generateMockForCity(city.name, city.numDays, formData.pace, offset)
    );
    offset += city.numDays;
  }
  const title =
    cities.length > 1
      ? cities.map((c) => c.name.split(",")[0]).join(" → ")
      : `${cities[0]?.name.replace(/,.*/, "").trim() || "Trip"} Adventure`;
  return { title, days };
}

async function callAI(prompt: string, formData: WizardFormData): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    return JSON.stringify(generateMockItinerary(formData));
  }

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "Voyage Itinerary Planner",
    },
    body: JSON.stringify({
      model: getModel(),
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
    }),
  });

  if (!res.ok) {
    console.error("OpenRouter error:", await res.text());
    return JSON.stringify(generateMockItinerary(formData));
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

function parseAIResponse(content: string): AIGeneratedItinerary {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  return JSON.parse(jsonMatch[0]) as AIGeneratedItinerary;
}

function normalizeItineraryToPace(
  itinerary: AIGeneratedItinerary,
  formData: WizardFormData
): AIGeneratedItinerary {
  const perDay = stopsPerDayForPace(formData.pace);
  const exploringDayCount = formData.cities.reduce((n, c) => n + c.numDays, 0);
  const used = new Set<string>();
  let poolIdx = 0;

  // Map ai days onto sequential exploring days; refill from each city's pool
  const days = Array.from({ length: exploringDayCount }, (_, dayIndex) => {
    let cityCursor = 0;
    let remaining = dayIndex;
    let city = formData.cities[0];
    for (const c of formData.cities) {
      if (remaining < c.numDays) {
        city = c;
        break;
      }
      remaining -= c.numDays;
      cityCursor++;
    }
    void cityCursor;

    const existing =
      itinerary.days.find((d) => d.dayIndex === dayIndex)?.stops ?? [];
    const stops: AIGeneratedStop[] = [];
    const pool = buildPlacePool(city.name);

    for (const stop of existing) {
      if (stops.length >= perDay) break;
      const key = stop.name.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      stops.push({ ...stop, dayIndex });
    }

    while (stops.length < perDay) {
      const place = pool[poolIdx % pool.length];
      poolIdx++;
      let name = place.name;
      let n = 2;
      while (used.has(name.toLowerCase())) {
        name = `${place.name} #${n++}`;
      }
      used.add(name.toLowerCase());
      stops.push({
        name,
        category: place.category,
        durationMinutes: place.durationMinutes,
        dayIndex,
      });
    }

    return {
      dayIndex,
      stops: ensureMealStopsForDay(stops, dayIndex, city.name),
    };
  });

  return {
    title: itinerary.title || formData.destinationName,
    days,
  };
}

export async function POST(request: NextRequest) {
  try {
    const formData = normalizeFormData(await request.json());
    const prompt = buildItineraryPrompt(formData);
    const aiContent = await callAI(prompt, formData);

    let aiItinerary: AIGeneratedItinerary;
    try {
      aiItinerary = parseAIResponse(aiContent);
    } catch {
      aiItinerary = generateMockItinerary(formData);
    }

    aiItinerary = normalizeItineraryToPace(aiItinerary, formData);

    const enrichedStops = new Map<string, Stop>();
    let exploreIdx = 0;

    for (const city of formData.cities) {
      const location =
        city.lat && city.lng ? { lat: city.lat, lng: city.lng } : undefined;

      for (let d = 0; d < city.numDays; d++) {
        const aiDay = aiItinerary.days[exploreIdx];
        exploreIdx++;
        if (!aiDay) continue;

        for (const aiStop of aiDay.stops) {
          const key = `${aiDay.dayIndex}-${aiStop.name}`;
          const place = await textSearchPlace(
            `${aiStop.name.replace(/#\d+$/, "").replace(/\(\d+\)$/, "").trim()} ${city.name}`,
            location
          );
          if (place) {
            enrichedStops.set(key, {
              id: crypto.randomUUID(),
              tripDayId: "",
              sortOrder: 0,
              placeId: place.placeId,
              name: place.name,
              category: aiStop.category,
              scheduledStart: "09:00",
              scheduledEnd: "10:00",
              durationMinutes: aiStop.durationMinutes,
              notes: aiStop.notes,
              metadata: placeToStopMetadata(place, true),
            });
          }
        }
      }
    }

    const trip = buildTripFromAI(formData, aiItinerary, enrichedStops);
    return NextResponse.json({ trip });
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 }
    );
  }
}
