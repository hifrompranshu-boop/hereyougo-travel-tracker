export const TRAVEL_STYLES = [
  "Foodie",
  "Culture",
  "Nature",
  "Nightlife",
  "Shopping",
  "Family-friendly",
  "Off-the-beaten-path",
  "Photography",
  "Wellness",
  "Adventure",
] as const;

export const INTERESTS = [
  { id: "museums", label: "Museums", icon: "🏛️" },
  { id: "landmarks", label: "Landmarks", icon: "🗼" },
  { id: "markets", label: "Local markets", icon: "🛒" },
  { id: "cafes", label: "Cafés", icon: "☕" },
  { id: "parks", label: "Parks", icon: "🌳" },
  { id: "beaches", label: "Beaches", icon: "🏖️" },
  { id: "architecture", label: "Architecture", icon: "🏗️" },
  { id: "live-music", label: "Live music", icon: "🎵" },
  { id: "food-tours", label: "Food tours", icon: "🍜" },
  { id: "art", label: "Art galleries", icon: "🎨" },
  { id: "history", label: "History", icon: "📜" },
  { id: "nightlife", label: "Nightlife", icon: "🌙" },
] as const;

export const AVOID_OPTIONS = [
  "Crowds",
  "Long hikes",
  "Early mornings",
  "Late nights",
  "Tourist traps",
  "Expensive venues",
] as const;

export const BUDGET_OPTIONS = [
  { id: "budget", label: "Budget" },
  { id: "mid", label: "Mid-range" },
  { id: "luxury", label: "Luxury" },
  { id: "mixed", label: "Mixed" },
] as const;

export const PACE_OPTIONS = [
  { id: "relaxed", label: "Relaxed", description: "~6h active per day" },
  { id: "moderate", label: "Moderate", description: "~8h active per day" },
  { id: "packed", label: "Packed", description: "~10h active per day" },
] as const;

export const MOBILITY_OPTIONS = [
  { id: "walk", label: "Walking-heavy" },
  { id: "mixed", label: "Mixed transit" },
  { id: "car", label: "Car" },
  { id: "accessible", label: "Accessibility needs" },
] as const;

export const CATEGORY_ICONS: Record<string, string> = {
  museum: "🏛️",
  restaurant: "🍽️",
  cafe: "☕",
  park: "🌳",
  landmark: "🗼",
  market: "🛒",
  beach: "🏖️",
  shopping: "🛍️",
  nightlife: "🌙",
  nature: "🏔️",
  culture: "🎭",
  transit: "🚆",
  default: "📍",
};

export function getCategoryIcon(category: string): string {
  const key = category.toLowerCase();
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return icon;
  }
  return CATEGORY_ICONS.default;
}
