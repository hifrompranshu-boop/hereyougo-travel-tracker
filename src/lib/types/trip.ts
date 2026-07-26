export type Pace = "relaxed" | "moderate" | "packed";
export type Budget = "budget" | "mid" | "luxury" | "mixed";
export type Mobility = "walk" | "mixed" | "car" | "accessible";
export type TripStatus = "draft" | "generated" | "archived";
export type TravelMode = "walk" | "transit" | "drive";

export interface OpeningHours {
  weekdayText?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

export interface PlacePhoto {
  photoReference?: string;
  url?: string;
}

export interface Place {
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  openingHours?: OpeningHours;
  formattedAddress?: string;
  photos?: PlacePhoto[];
  rating?: number;
  /** 0=free … 4=very expensive (Google Places) */
  priceLevel?: number;
  /** Estimated visit cost in GBP */
  estimatedCostGbp?: number;
  cachedAt?: string;
}

export interface StopMetadata {
  rating?: number;
  photoUrl?: string;
  /** 0=free … 4=very expensive */
  priceLevel?: number;
  /** Estimated visit cost in GBP */
  estimatedCostGbp?: number;
  verified?: boolean;
  formattedAddress?: string;
  openingHours?: OpeningHours;
  lat?: number;
  lng?: number;
  description?: string;
}

export interface Stop {
  id: string;
  tripDayId: string;
  sortOrder: number;
  placeId: string;
  name: string;
  category: string;
  scheduledStart: string;
  scheduledEnd: string;
  durationMinutes: number;
  notes?: string;
  userLocked?: boolean;
  metadata?: StopMetadata;
}

export interface TravelLeg {
  id: string;
  fromStopId: string;
  toStopId: string;
  durationMinutes: number;
  distanceMeters: number;
  mode: TravelMode;
}

export interface TripDay {
  id: string;
  tripId: string;
  dayIndex: number;
  date: string;
  label: string;
  stops: Stop[];
  travelLegs: TravelLeg[];
  /** Soft spend cap for this day in GBP */
  budgetGbp?: number;
  /** Party for this day (defaults from trip preferences) */
  adults?: number;
  children?: number;
  pets?: number;
  collapsed?: boolean;
  cityId?: string;
  cityName?: string;
  isTransitDay?: boolean;
}

/** Transit plan between two cities (tickets assumed booked / planned) */
export type CityTransitType = "flexible" | "booked";

export interface CityTransitPlan {
  type: CityTransitType;
  /** Max hours willing to spend in transit (flexible) */
  maxHours: number;
  /** Exact departure time HH:mm (booked) */
  departTime: string;
  /** Known journey duration in hours (booked) */
  durationHours: number;
}

export interface WizardCity {
  id: string;
  placeId: string;
  name: string;
  lat?: number;
  lng?: number;
  /** Landing / arrival datetime — tickets already booked */
  arrivalDate: string;
  arrivalTime: string;
  numDays: number;
  /** How you get to the next city (omit on last city) */
  transitToNext?: CityTransitPlan;
}

export interface TripCity {
  id: string;
  placeId: string;
  name: string;
  lat?: number;
  lng?: number;
  arrivalDate: string;
  arrivalTime: string;
  numDays: number;
  transitToNext?: CityTransitPlan;
}

export interface TripPreferences {
  pace: Pace;
  budget: Budget;
  /** Default daily spend target in GBP (seeded onto each day) */
  defaultBudgetPerDay?: number;
  travelStyles: string[];
  interests: string[];
  mustInclude: string[];
  avoid: string[];
  freeTextNotes?: string;
  dayStartTime: string;
  dayEndTime: string;
  mobility: Mobility;
  strictHours?: boolean;
  adults: number;
  children: number;
  pets: number;
}

export interface BoardLayout {
  collapsedDays: string[];
}

export interface Trip {
  id: string;
  userId?: string | null;
  guestDeviceId?: string;
  title: string;
  destinationPlaceId: string;
  destinationName: string;
  destinationLat?: number;
  destinationLng?: number;
  startDate: string;
  numDays: number;
  status: TripStatus;
  preferences: TripPreferences;
  days: TripDay[];
  /** Multi-city itinerary segments (optional for legacy trips) */
  cities?: TripCity[];
  boardLayout?: BoardLayout;
  coverPhotoUrl?: string;
  shareId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WizardFormData {
  /** Multi-city plan — primary source of destinations & dates */
  cities: WizardCity[];
  /** Derived convenience fields kept for prompts / legacy */
  destinationPlaceId: string;
  destinationName: string;
  destinationLat?: number;
  destinationLng?: number;
  startDate: string;
  numDays: number;
  dayStartTime: string;
  dayEndTime: string;
  pace: Pace;
  budget: Budget;
  /** Default daily spend target in GBP */
  defaultBudgetPerDay: number;
  travelStyles: string[];
  mobility: Mobility;
  interests: string[];
  mustInclude: string[];
  avoid: string[];
  freeTextNotes: string;
  adults: number;
  children: number;
  pets: number;
}

export interface DayTimeStats {
  activeMinutes: number;
  travelMinutes: number;
  totalMinutes: number;
  isOverpacked: boolean;
  maxMinutes: number;
}

export interface OptimizationHint {
  message: string;
  fromStopId: string;
  toStopId: string;
  savingsMinutes: number;
}

export interface AIGeneratedStop {
  name: string;
  category: string;
  durationMinutes: number;
  dayIndex: number;
  notes?: string;
}

export interface AIGeneratedItinerary {
  title: string;
  days: Array<{
    dayIndex: number;
    stops: AIGeneratedStop[];
  }>;
}

export const PACE_MAX_MINUTES: Record<Pace, number> = {
  relaxed: 360,
  moderate: 480,
  packed: 600,
};
