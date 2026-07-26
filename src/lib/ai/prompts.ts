import type { WizardCity, WizardFormData } from "@/lib/types/trip";
import { paceStopRangeLabel, stopsPerDayForPace } from "@/lib/ai/pace";

export function buildItineraryPrompt(data: WizardFormData): string {
  const perDay = stopsPerDayForPace(data.pace);
  const range = paceStopRangeLabel(data.pace);
  const cities: Array<Pick<WizardCity, "name" | "numDays" | "arrivalDate" | "arrivalTime" | "transitToNext">> =
    data.cities?.length
      ? data.cities
      : [
          {
            name: data.destinationName,
            numDays: data.numDays,
            arrivalDate: data.startDate,
            arrivalTime: data.dayStartTime,
          },
        ];

  const cityBlock = cities
    .map(
      (c, i) =>
        `  ${i + 1}. ${c.name} — ${c.numDays} day(s), arrive ${c.arrivalDate} ${c.arrivalTime}` +
        (c.transitToNext
          ? c.transitToNext.type === "booked"
            ? ` → next city depart ${c.transitToNext.departTime} (${c.transitToNext.durationHours}h journey)`
            : ` → next city max transit ${c.transitToNext.maxHours}h`
          : "")
    )
    .join("\n");

  return `Create a detailed multi-city travel itinerary.

Cities (tickets already booked):
${cityBlock}

Trip parameters:
- Route: ${data.destinationName}
- Start date: ${data.startDate}
- Daily exploring hours: ${data.dayStartTime} to ${data.dayEndTime}
- Pace: ${data.pace} (IMPORTANT: put EXACTLY ${perDay} stops on EVERY exploring day, within ${range})
- Budget: ${data.budget} (~£${data.defaultBudgetPerDay ?? 80} per day for activities & meals)
- Travel styles: ${data.travelStyles.join(", ") || "general exploration"}
- Interests: ${data.interests.join(", ") || "mixed"}
- Mobility: ${data.mobility}
- Party: ${data.adults} adult(s), ${data.children} child(ren), ${data.pets} pet(s)
- Must include: ${data.mustInclude.join(", ") || "none specified"}
- Avoid: ${data.avoid.join(", ") || "none specified"}
${data.freeTextNotes ? `- Additional notes: ${data.freeTextNotes}` : ""}

Return ONLY valid JSON matching this schema:
{
  "title": "string - catchy trip title",
  "days": [
    {
      "dayIndex": 0,
      "stops": [
        {
          "name": "Exact real venue/place name searchable on Google Maps",
          "category": "museum|restaurant|cafe|park|landmark|market|beach|shopping|nightlife|culture|nature",
          "durationMinutes": 60,
          "dayIndex": 0,
          "notes": "optional short tip"
        }
      ]
    }
  ]
}

Rules:
- Only include exploring days in each city (not transit days). dayIndex is global from 0.
- For each city, generate exactly that city's numDays of itinerary using REAL places in THAT city
- EVERY exploring day MUST have exactly ${perDay} stops (pace=${data.pace})
- Spread unique places; do not repeat the same venue
- Use REAL place names that exist in the city for that day
- durationMinutes: 30-180 depending on activity; keep total active+travel time realistic for ${data.pace} pace
- Mix morning / midday / afternoon / evening activities within each day
- EVERY day MUST include a lunch stop (restaurant/cafe around midday) AND a dinner stop (restaurant in the evening)
- Cluster stops geographically when possible so travel between consecutive stops stays under ~20 minutes (walk/transit/drive)
- Prefer venues that are OPEN during the scheduled visit; avoid places closed that day
- Tailor picks for the party size (kids/pets-friendly when children or pets > 0)
- Balance interests across days
- No markdown, no explanation, JSON only`;
}

export const SYSTEM_PROMPT = `You are an expert travel planner. You output only valid JSON itineraries with real, searchable place names. Always fill every day with the required number of stops for the requested pace. Never invent fictional venues.`;

export function buildRegenerateDayPrompt(
  destination: string,
  dayIndex: number,
  interests: string[],
  pace: string,
  existingStopNames: string[]
): string {
  const perDay = stopsPerDayForPace(pace);
  return `Suggest EXACTLY ${perDay} stops for Day ${dayIndex + 1} in ${destination}.
Pace: ${pace} → ${perDay} stops required.
Interests: ${interests.join(", ")}.
Avoid duplicating: ${existingStopNames.join(", ") || "none"}.

Return ONLY JSON:
{
  "stops": [
    { "name": "...", "category": "...", "durationMinutes": 90, "dayIndex": ${dayIndex} }
  ]
}
The stops array MUST contain exactly ${perDay} items.`;
}

export function buildReplaceStopPrompt(
  destination: string,
  stopName: string,
  category: string,
  interests: string[]
): string {
  return `Suggest 3 alternative places near ${destination} similar to "${stopName}" (${category}).
Interests: ${interests.join(", ")}.

Return ONLY JSON:
{
  "alternatives": [
    { "name": "...", "category": "...", "durationMinutes": 90 }
  ]
}`;
}

export function buildWeatherSwapPrompt(
  destination: string,
  outdoorStops: string[],
  weather: string
): string {
  return `Weather in ${destination}: ${weather}. These outdoor stops may be affected: ${outdoorStops.join(", ")}.
Suggest indoor alternatives. Return ONLY JSON:
{
  "swaps": [
    { "original": "...", "alternative": "...", "category": "...", "durationMinutes": 90 }
  ]
}`;
}

export function buildApplyPreferencesPrompt(
  destination: string,
  instruction: string,
  days: Array<{
    dayIndex: number;
    label: string;
    stops: Array<{ name: string; category: string; locked?: boolean }>;
  }>
): string {
  const dayBlock = days
    .map(
      (d) =>
        `Day ${d.dayIndex + 1} (${d.label}):\n` +
        d.stops
          .map(
            (s) =>
              `  - ${s.name} [${s.category}]${s.locked ? " (LOCKED — do not change)" : ""}`
          )
          .join("\n")
    )
    .join("\n");

  return `The traveler wants to update their ${destination} itinerary.

Instruction: "${instruction}"

Current itinerary:
${dayBlock}

Return ONLY JSON with replacements needed to satisfy the instruction (max 8). Prefer changing unlocked stops. Keep similar duration when possible. Use REAL searchable place names in ${destination}.

{
  "replacements": [
    {
      "dayIndex": 0,
      "originalName": "exact current stop name",
      "name": "new place name",
      "category": "museum|restaurant|cafe|park|landmark|market|beach|shopping|nightlife|culture|nature",
      "durationMinutes": 90
    }
  ],
  "summary": "one short sentence of what changed"
}`;
}
