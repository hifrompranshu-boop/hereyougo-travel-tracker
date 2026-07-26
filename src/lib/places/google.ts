import type { Place, StopMetadata } from "@/lib/types/trip";
import { costGbpFromPriceLevel } from "@/lib/export/budget";
import {
  defaultOpeningHours,
  eveningOpeningHours,
} from "@/lib/time/hours";

const MOCK_DESTINATIONS: Place[] = [
  {
    placeId: "mock-1",
    name: "Paris, France",
    lat: 48.8566,
    lng: 2.3522,
    formattedAddress: "Paris, France",
    rating: 4.8,
    photos: [{ url: "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400" }],
  },
  {
    placeId: "mock-2",
    name: "Tokyo, Japan",
    lat: 35.6762,
    lng: 139.6503,
    formattedAddress: "Tokyo, Japan",
    rating: 4.7,
    photos: [{ url: "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400" }],
  },
  {
    placeId: "mock-3",
    name: "Barcelona, Spain",
    lat: 41.3874,
    lng: 2.1686,
    formattedAddress: "Barcelona, Spain",
    rating: 4.6,
    photos: [{ url: "https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400" }],
  },
  {
    placeId: "mock-4",
    name: "New York, NY, USA",
    lat: 40.7128,
    lng: -74.006,
    formattedAddress: "New York, NY, USA",
    rating: 4.7,
    photos: [{ url: "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400" }],
  },
  {
    placeId: "mock-5",
    name: "London, UK",
    lat: 51.5074,
    lng: -0.1278,
    formattedAddress: "London, UK",
    rating: 4.6,
    photos: [{ url: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400" }],
  },
];

export function getGoogleApiKey(): string | undefined {
  return process.env.GOOGLE_PLACES_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_PLACES_API_KEY;
}

function mockSearch(query: string): Place[] {
  const q = query.toLowerCase();
  const matched = MOCK_DESTINATIONS.filter((p) => p.name.toLowerCase().includes(q));
  if (matched.length > 0) return matched;
  // Always return something usable so the wizard isn't stuck
  return [
    {
      placeId: `mock-query-${hashCode(query)}`,
      name: query,
      lat: 48.8566,
      lng: 2.3522,
      formattedAddress: query,
      rating: 4.5,
    },
    ...MOCK_DESTINATIONS.slice(0, 3),
  ];
}

/** Places API (New) — Autocomplete */
export async function searchPlaces(
  query: string,
  location?: { lat: number; lng: number }
): Promise<Place[]> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) return mockSearch(query);

  try {
    const body: Record<string, unknown> = {
      input: query,
      includedPrimaryTypes: ["locality", "administrative_area_level_1", "country"],
    };
    if (location) {
      body.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 50000,
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      console.error(
        "Places autocomplete (New) error:",
        data.error?.status ?? res.status,
        data.error?.message
      );
      return mockSearch(query);
    }

    const suggestions = data.suggestions ?? [];
    if (suggestions.length === 0) return mockSearch(query);

    const places: Place[] = [];
    for (const suggestion of suggestions.slice(0, 5)) {
      const pred = suggestion.placePrediction;
      if (!pred) continue;

      const placeId = (pred.placeId as string) || (pred.place as string)?.replace("places/", "");
      const label =
        pred.structuredFormat?.mainText?.text ||
        pred.text?.text ||
        "Unknown";

      // Enrich with details when possible; still show suggestion if details fail
      const details = placeId ? await getPlaceDetails(placeId) : null;
      if (details) {
        places.push(details);
      } else {
        places.push({
          placeId: placeId || `pred-${hashCode(label)}`,
          name: label,
          lat: 0,
          lng: 0,
          formattedAddress: pred.text?.text,
        });
      }
    }

    return places.length > 0 ? places : mockSearch(query);
  } catch (error) {
    console.error("Places search failed:", error);
    return mockSearch(query);
  }
}

function mockPlaceFromQuery(name: string): Place {
  const mock = MOCK_DESTINATIONS.find((p) =>
    p.name.toLowerCase().includes(name.toLowerCase().slice(0, 5))
  );
  const isEvening = /night|lounge|bar|club|music venue/i.test(name);
  const hours = isEvening ? eveningOpeningHours() : defaultOpeningHours();
  const closedMonday = /museum|gallery/i.test(name);
  const openingHours = closedMonday
    ? {
        ...hours,
        weekdayText: hours.weekdayText?.map((line) =>
          line.startsWith("Monday") ? "Monday: Closed" : line
        ),
        periods: hours.periods?.filter((p) => p.open.day !== 1),
      }
    : hours;

  if (mock) {
    const priceLevel = mock.priceLevel ?? 1;
    return {
      ...mock,
      name,
      openingHours,
      priceLevel,
      estimatedCostGbp: costGbpFromPriceLevel(priceLevel),
    };
  }
  const idx = Math.abs(hashCode(name)) % MOCK_DESTINATIONS.length;
  const base = MOCK_DESTINATIONS[idx];
  const h = Math.abs(hashCode(name));
  const latOff = ((h % 40) - 20) * 0.0012;
  const lngOff = (((h / 40) | 0) % 40 - 20) * 0.0012;
  const priceLevel = (Math.abs(hashCode(name)) % 3) + 1;
  return {
    ...base,
    placeId: `mock-${hashCode(name)}`,
    name,
    lat: base.lat + latOff,
    lng: base.lng + lngOff,
    openingHours,
    priceLevel,
    estimatedCostGbp: costGbpFromPriceLevel(priceLevel),
  };
}

/** Places API (New) — Text Search (multiple) */
export async function textSearchPlaces(
  name: string,
  location?: { lat: number; lng: number },
  pageSize = 5
): Promise<Place[]> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    const suffixes = ["", " Museum", " Park", " Café", " Market", " Gallery"];
    return suffixes.slice(0, pageSize).map((suffix, i) =>
      mockPlaceFromQuery(`${name.replace(/,.*/, "").trim()}${suffix || ` Spot ${i + 1}`}`)
    );
  }

  try {
    const body: Record<string, unknown> = {
      textQuery: name,
      pageSize,
    };
    if (location) {
      body.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 30000,
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.priceLevel,places.photos,places.regularOpeningHours",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || data.error || !data.places?.length) {
      console.error("Text search (many) error:", data.error?.message ?? res.status);
      return [mockPlaceFromQuery(name)];
    }
    return (data.places as Record<string, unknown>[]).map(placeFromNewApi);
  } catch (error) {
    console.error("Text search (many) failed:", error);
    return [mockPlaceFromQuery(name)];
  }
}

/** Places API (New) — Text Search */
export async function textSearchPlace(
  name: string,
  location?: { lat: number; lng: number }
): Promise<Place | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey) {
    return mockPlaceFromQuery(name);
  }

  try {
    const body: Record<string, unknown> = {
      textQuery: name,
      pageSize: 1,
    };
    if (location) {
      body.locationBias = {
        circle: {
          center: { latitude: location.lat, longitude: location.lng },
          radius: 30000,
        },
      };
    }

    const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.formattedAddress,places.rating,places.priceLevel,places.photos,places.regularOpeningHours",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok || data.error || !data.places?.length) {
      console.error("Text search error:", data.error?.message ?? res.status);
      return null;
    }

    return placeFromNewApi(data.places[0]);
  } catch (error) {
    console.error("Text search failed:", error);
    return null;
  }
}

/** Places API (New) — Place Details */
export async function getPlaceDetails(placeId: string): Promise<Place | null> {
  const apiKey = getGoogleApiKey();
  if (!apiKey || placeId.startsWith("mock-") || placeId.startsWith("pred-")) {
    return MOCK_DESTINATIONS.find((p) => p.placeId === placeId) ?? null;
  }

  const id = placeId.startsWith("places/") ? placeId : `places/${placeId}`;

  try {
    const res = await fetch(`https://places.googleapis.com/v1/${id}`, {
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask":
          "id,displayName,location,formattedAddress,rating,priceLevel,photos,regularOpeningHours",
      },
    });

    const data = await res.json();
    if (!res.ok || data.error) {
      console.error("Place details error:", data.error?.message ?? res.status);
      return null;
    }

    return placeFromNewApi(data);
  } catch (error) {
    console.error("Place details failed:", error);
    return null;
  }
}

function placeFromNewApi(result: Record<string, unknown>): Place {
  const apiKey = getGoogleApiKey();
  const location = result.location as { latitude?: number; longitude?: number } | undefined;
  const displayName = result.displayName as { text?: string } | undefined;
  const photos = (result.photos as Array<{ name?: string }>) ?? [];
  const hours = result.regularOpeningHours as
    | {
        weekdayDescriptions?: string[];
        periods?: Array<{
          open?: { day?: number; hour?: number; minute?: number };
          close?: { day?: number; hour?: number; minute?: number };
        }>;
      }
    | undefined;

  const rawId = (result.id as string) || "";
  const placeId = rawId.replace(/^places\//, "");

  const priceLevelMap: Record<string, number> = {
    PRICE_LEVEL_FREE: 0,
    PRICE_LEVEL_INEXPENSIVE: 1,
    PRICE_LEVEL_MODERATE: 2,
    PRICE_LEVEL_EXPENSIVE: 3,
    PRICE_LEVEL_VERY_EXPENSIVE: 4,
  };

  return {
    placeId,
    name: displayName?.text ?? "Unknown",
    lat: location?.latitude ?? 0,
    lng: location?.longitude ?? 0,
    formattedAddress: result.formattedAddress as string | undefined,
    rating: result.rating as number | undefined,
    priceLevel:
      typeof result.priceLevel === "string"
        ? priceLevelMap[result.priceLevel]
        : (result.priceLevel as number | undefined),
    openingHours: hours
      ? {
          weekdayText: hours.weekdayDescriptions,
          periods: hours.periods?.map((p) => ({
            open: {
              day: p.open?.day ?? 0,
              time: `${String(p.open?.hour ?? 0).padStart(2, "0")}${String(p.open?.minute ?? 0).padStart(2, "0")}`,
            },
            close: p.close
              ? {
                  day: p.close.day ?? 0,
                  time: `${String(p.close.hour ?? 0).padStart(2, "0")}${String(p.close.minute ?? 0).padStart(2, "0")}`,
                }
              : undefined,
          })),
        }
      : undefined,
    photos: photos.slice(0, 3).map((p) => ({
      photoReference: p.name,
      url:
        p.name && apiKey
          ? `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=400&key=${apiKey}`
          : undefined,
    })),
    cachedAt: new Date().toISOString(),
  };
}

export function placeToStopMetadata(place: Place, verified = true): StopMetadata {
  const priceLevel = place.priceLevel;
  const estimatedCostGbp =
    place.estimatedCostGbp ??
    (priceLevel != null ? costGbpFromPriceLevel(priceLevel) : costGbpFromPriceLevel(2));

  return {
    rating: place.rating,
    photoUrl: place.photos?.[0]?.url,
    priceLevel,
    estimatedCostGbp,
    verified,
    formattedAddress: place.formattedAddress,
    openingHours: place.openingHours ?? defaultOpeningHours(),
    lat: place.lat,
    lng: place.lng,
    description: place.formattedAddress
      ? `A highlight in ${place.formattedAddress.split(",").slice(-2).join(",").trim()}.`
      : undefined,
  };
}

export async function getDirections(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: "walking" | "transit" | "driving" = "walking"
): Promise<{ durationMinutes: number; distanceMeters: number } | null> {
  const { estimateTravelMinutes } = await import("@/lib/time/engine");
  const modeMap = { walking: "walk", transit: "transit", driving: "drive" } as const;
  const apiKey = getGoogleApiKey();

  // Prefer haversine estimate if no key; try Routes API (New) when key present
  if (!apiKey) {
    const mins = estimateTravelMinutes(
      origin.lat,
      origin.lng,
      destination.lat,
      destination.lng,
      modeMap[mode]
    );
    return { durationMinutes: mins, distanceMeters: mins * 80 };
  }

  const travelMode =
    mode === "walking" ? "WALK" : mode === "transit" ? "TRANSIT" : "DRIVE";

  try {
    const res = await fetch(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": "routes.duration,routes.distanceMeters",
        },
        body: JSON.stringify({
          origin: {
            location: { latLng: { latitude: origin.lat, longitude: origin.lng } },
          },
          destination: {
            location: {
              latLng: { latitude: destination.lat, longitude: destination.lng },
            },
          },
          travelMode,
        }),
      }
    );

    const data = await res.json();
    const route = data.routes?.[0];
    if (route) {
      const durationSec = parseInt(String(route.duration ?? "0").replace("s", ""), 10);
      return {
        durationMinutes: Math.max(1, Math.ceil(durationSec / 60)),
        distanceMeters: route.distanceMeters ?? 0,
      };
    }
  } catch (error) {
    console.error("Routes API failed, using estimate:", error);
  }

  // Fallback estimate so the board still works
  const mins = estimateTravelMinutes(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng,
    modeMap[mode]
  );
  return { durationMinutes: mins, distanceMeters: mins * 80 };
}

function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
