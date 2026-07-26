import { NextRequest, NextResponse } from "next/server";
import { buildApplyPreferencesPrompt, SYSTEM_PROMPT } from "@/lib/ai/prompts";
import { textSearchPlace, placeToStopMetadata } from "@/lib/places/google";

function getOpenRouterKey(): string | undefined {
  return (
    process.env.OPENROUTER_API_KEY ||
    process.env.ANTHROPIC_AUTH_TOKEN ||
    process.env.ANTHROPIC_API_KEY
  );
}

type DayInput = {
  dayIndex: number;
  label: string;
  stops: Array<{ name: string; category: string; locked?: boolean }>;
};

type Replacement = {
  dayIndex: number;
  originalName: string;
  name: string;
  category: string;
  durationMinutes: number;
};

function mockReplacements(instruction: string, days: DayInput[]): Replacement[] {
  const indoor = /rain|indoor|museum|gallery|cold|weather/i.test(instruction);
  const foodie = /food|restaurant|cafe|eat|dinner|lunch/i.test(instruction);
  const out: Replacement[] = [];

  for (const day of days) {
    for (const stop of day.stops) {
      if (stop.locked || out.length >= 6) continue;
      if (indoor && /park|beach|outdoor|garden|nature|walk/i.test(stop.category + stop.name)) {
        out.push({
          dayIndex: day.dayIndex,
          originalName: stop.name,
          name: `${day.label.split("·")[0]?.trim() || "City"} Covered Market`,
          category: "market",
          durationMinutes: 75,
        });
      } else if (foodie && /landmark|museum|culture/i.test(stop.category) && out.length < 3) {
        out.push({
          dayIndex: day.dayIndex,
          originalName: stop.name,
          name: `Local Bistro near ${stop.name.split(" ")[0]}`,
          category: "restaurant",
          durationMinutes: 90,
        });
      }
    }
  }

  if (out.length === 0 && days[0]?.stops[0] && !days[0].stops[0].locked) {
    const s = days[0].stops[0];
    out.push({
      dayIndex: days[0].dayIndex,
      originalName: s.name,
      name: `Recommended spot for: ${instruction.slice(0, 40)}`,
      category: s.category || "landmark",
      durationMinutes: 90,
    });
  }

  return out;
}

async function callAI(prompt: string): Promise<string> {
  const apiKey = getOpenRouterKey();
  if (!apiKey) return "";

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
      temperature: 0.5,
    }),
  });

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      destination,
      instruction,
      days,
      destinationLat,
      destinationLng,
    } = body as {
      destination: string;
      instruction: string;
      days: DayInput[];
      destinationLat?: number;
      destinationLng?: number;
    };

    if (!instruction?.trim() || !days?.length) {
      return NextResponse.json({ error: "Missing instruction or days" }, { status: 400 });
    }

    const prompt = buildApplyPreferencesPrompt(
      destination,
      instruction.trim(),
      days
    );
    const content = await callAI(prompt);
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    let parsed: { replacements?: Replacement[]; summary?: string } = {};
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        parsed = {};
      }
    }

    let replacements = (parsed.replacements ?? []).slice(0, 8);
    if (replacements.length === 0) {
      replacements = mockReplacements(instruction, days);
    }

    const location =
      destinationLat && destinationLng
        ? { lat: destinationLat, lng: destinationLng }
        : undefined;

    const enriched = await Promise.all(
      replacements.map(async (r) => {
        const place = await textSearchPlace(`${r.name} ${destination}`, location);
        return {
          dayIndex: r.dayIndex,
          originalName: r.originalName,
          name: place?.name ?? r.name,
          category: r.category || "landmark",
          durationMinutes: r.durationMinutes || 90,
          placeId: place?.placeId,
          metadata: place ? placeToStopMetadata(place) : undefined,
        };
      })
    );

    return NextResponse.json({
      replacements: enriched,
      summary:
        parsed.summary ||
        `Updated ${enriched.length} stop${enriched.length === 1 ? "" : "s"} from your note`,
    });
  } catch (error) {
    console.error("Apply preferences error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
