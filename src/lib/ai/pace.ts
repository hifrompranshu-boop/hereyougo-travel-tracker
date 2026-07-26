import type { AIGeneratedStop, Pace } from "@/lib/types/trip";

/** Target stops per day for each travel pace (includes lunch + dinner) */
export const PACE_STOPS: Record<Pace, { min: number; max: number; target: number }> = {
  relaxed: { min: 4, max: 5, target: 4 },
  moderate: { min: 5, max: 6, target: 5 },
  packed: { min: 6, max: 8, target: 7 },
};

export function stopsPerDayForPace(pace: Pace | string): number {
  const key = (pace in PACE_STOPS ? pace : "moderate") as Pace;
  return PACE_STOPS[key].target;
}

export function paceStopRangeLabel(pace: Pace | string): string {
  const key = (pace in PACE_STOPS ? pace : "moderate") as Pace;
  const { min, max } = PACE_STOPS[key];
  return `${min}-${max}`;
}

export function parsePaceFromPrompt(prompt: string): Pace {
  const match = prompt.match(/Pace:\s*(relaxed|moderate|packed)/i);
  const value = match?.[1]?.toLowerCase();
  if (value === "relaxed" || value === "packed" || value === "moderate") {
    return value;
  }
  return "moderate";
}

/** Curated stop templates reused/expanded for mock + padding */
export function buildPlacePool(destination: string): Array<{
  name: string;
  category: string;
  durationMinutes: number;
}> {
  const city = destination.replace(/,.*/, "").trim() || "City";
  return [
    { name: `${city} Central Museum`, category: "museum", durationMinutes: 120 },
    { name: `${city} Historic Fort`, category: "landmark", durationMinutes: 90 },
    { name: `${city} Local Food Market`, category: "market", durationMinutes: 60 },
    { name: `${city} City Park`, category: "park", durationMinutes: 75 },
    { name: `${city} Artisan Café`, category: "cafe", durationMinutes: 45 },
    { name: `${city} Cathedral / Temple`, category: "landmark", durationMinutes: 60 },
    { name: `${city} Sunset Viewpoint`, category: "nature", durationMinutes: 75 },
    { name: `${city} Night Market`, category: "nightlife", durationMinutes: 90 },
    { name: `${city} Contemporary Art Gallery`, category: "culture", durationMinutes: 90 },
    { name: `${city} Old Town Walking Street`, category: "landmark", durationMinutes: 80 },
    { name: `${city} Specialty Coffee Roastery`, category: "cafe", durationMinutes: 40 },
    { name: `${city} Botanical Garden`, category: "park", durationMinutes: 90 },
    { name: `${city} Street Food Alley`, category: "restaurant", durationMinutes: 70 },
    { name: `${city} Design District Shops`, category: "shopping", durationMinutes: 75 },
    { name: `${city} Lakeside Promenade`, category: "nature", durationMinutes: 60 },
    { name: `${city} Heritage Neighborhood`, category: "culture", durationMinutes: 85 },
    { name: `${city} Rooftop Lounge`, category: "nightlife", durationMinutes: 90 },
    { name: `${city} Breakfast Spot`, category: "cafe", durationMinutes: 50 },
    { name: `${city} Science / Tech Museum`, category: "museum", durationMinutes: 110 },
    { name: `${city} Craft Bazaar`, category: "market", durationMinutes: 65 },
    { name: `${city} Riverside Walk`, category: "nature", durationMinutes: 55 },
    { name: `${city} Iconic Palace / Hall`, category: "landmark", durationMinutes: 100 },
    { name: `${city} Neighborhood Bakery`, category: "cafe", durationMinutes: 35 },
    { name: `${city} Live Music Venue`, category: "nightlife", durationMinutes: 100 },
    { name: `${city} Sculpture Park`, category: "park", durationMinutes: 70 },
    { name: `${city} Regional Cuisine Restaurant`, category: "restaurant", durationMinutes: 80 },
    { name: `${city} Photo Spot Overlook`, category: "nature", durationMinutes: 45 },
    { name: `${city} Indie Bookstore Café`, category: "cafe", durationMinutes: 50 },
    { name: `${city} Lunch Bistro`, category: "restaurant", durationMinutes: 75 },
    { name: `${city} Dinner Restaurant`, category: "restaurant", durationMinutes: 90 },
  ];
}

const MEAL_CATEGORIES = new Set(["restaurant", "cafe", "market"]);

/** Ensure each day has a lunch + dinner meal stop at sensible positions */
export function ensureMealStopsForDay(
  stops: AIGeneratedStop[],
  dayIndex: number,
  destination: string
): AIGeneratedStop[] {
  const city = destination.replace(/,.*/, "").trim() || "City";
  const used = new Set(stops.map((s) => s.name.toLowerCase()));
  const result = [...stops];

  const hasLunch = result.some(
    (s) => MEAL_CATEGORIES.has(s.category.toLowerCase()) && s.durationMinutes >= 45
  );
  const mealCount = result.filter((s) =>
    MEAL_CATEGORIES.has(s.category.toLowerCase())
  ).length;

  if (!hasLunch) {
    let name = `${city} Lunch Spot`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${city} Lunch Spot #${n++}`;
    used.add(name.toLowerCase());
    const insertAt = Math.min(Math.max(1, Math.floor(result.length / 3)), result.length);
    result.splice(insertAt, 0, {
      name,
      category: "restaurant",
      durationMinutes: 75,
      dayIndex,
      notes: "Lunch break",
    });
  }

  if (mealCount < 2) {
    let name = `${city} Dinner Spot`;
    let n = 2;
    while (used.has(name.toLowerCase())) name = `${city} Dinner Spot #${n++}`;
    used.add(name.toLowerCase());
    result.push({
      name,
      category: "restaurant",
      durationMinutes: 90,
      dayIndex,
      notes: "Dinner",
    });
  }

  return result.map((s) => ({ ...s, dayIndex }));
}
