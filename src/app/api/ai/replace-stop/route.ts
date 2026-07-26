import { NextRequest, NextResponse } from "next/server";
import { buildReplaceStopPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { costGbpFromPriceLevel } from "@/lib/export/budget";
import { textSearchPlace, textSearchPlaces, placeToStopMetadata } from "@/lib/places/google";
import type { StopMetadata } from "@/lib/types/trip";

function fitsBudget(
  metadata: StopMetadata | undefined,
  maxPriceLevel?: number,
  maxCostGbp?: number
): boolean {
  if (!metadata) return true;
  if (typeof maxPriceLevel === "number" && (metadata.priceLevel ?? 2) > maxPriceLevel) {
    return false;
  }
  if (typeof maxCostGbp === "number") {
    const cost = metadata.estimatedCostGbp ?? costGbpFromPriceLevel(metadata.priceLevel);
    if (cost > maxCostGbp) return false;
  }
  return true;
}

function getOpenRouterKey(): string | undefined {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY
  );
}

async function callAI(prompt: string): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) {
    return JSON.stringify({
      alternatives: [
        { name: "Similar Local Spot A", category: "culture", durationMinutes: 90 },
        { name: "Similar Local Spot B", category: "culture", durationMinutes: 75 },
        { name: "Similar Local Spot C", category: "cafe", durationMinutes: 60 },
      ],
    });
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
      temperature: 0.7,
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
      stopName,
      category,
      interests,
      destinationLat,
      destinationLng,
      query,
      maxPriceLevel,
      maxCostGbp,
    } = body;

    const location =
      destinationLat && destinationLng
        ? { lat: destinationLat, lng: destinationLng }
        : undefined;

    // User typed a search — return place matches as swap candidates
    if (typeof query === "string" && query.trim().length >= 2) {
      const places = await textSearchPlaces(
        `${query.trim()} in ${destination ?? ""}`,
        location,
        8
      );
      const alternatives = places
        .map((p) => ({
          name: p.name,
          category: category || "landmark",
          durationMinutes: 90,
          placeId: p.placeId,
          metadata: placeToStopMetadata(p),
        }))
        .filter((a) => fitsBudget(a.metadata, maxPriceLevel, maxCostGbp));
      return NextResponse.json({ alternatives });
    }

    const prompt = buildReplaceStopPrompt(
      destination,
      stopName,
      category,
      interests ?? []
    );
    const content = await callAI(prompt);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { alternatives: [] };

    const enriched = await Promise.all(
      (parsed.alternatives ?? [])
        .slice(0, 8)
        .map(
          async (alt: {
            name: string;
            category: string;
            durationMinutes: number;
          }) => {
            const place = await textSearchPlace(
              `${alt.name} ${destination}`,
              location
            );
            return {
              ...alt,
              placeId: place?.placeId,
              metadata: place ? placeToStopMetadata(place) : undefined,
            };
          }
        )
    );

    const filtered = enriched.filter((a) =>
      fitsBudget(a.metadata, maxPriceLevel, maxCostGbp)
    );
    return NextResponse.json({
      alternatives: filtered.length > 0 ? filtered : enriched.slice(0, 5),
    });
  } catch (error) {
    console.error("Replace stop error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
