import type { Budget, Stop, Trip, TripDay } from "@/lib/types/trip";
import { computeDayStats } from "@/lib/time/engine";

/** Typical per-stop spend in GBP by Google priceLevel (0–4) */
export const PRICE_ESTIMATES_GBP: Record<number, number> = {
  0: 0,
  1: 12,
  2: 30,
  3: 65,
  4: 120,
};

export const DEFAULT_BUDGET_BY_TIER: Record<Budget, number> = {
  budget: 40,
  mid: 80,
  luxury: 160,
  mixed: 80,
};

export const DAY_BUDGET_MIN = 20;
export const DAY_BUDGET_MAX = 600;

export function costGbpFromPriceLevel(priceLevel?: number): number {
  const level = priceLevel ?? 2;
  return PRICE_ESTIMATES_GBP[level] ?? PRICE_ESTIMATES_GBP[2];
}

/** Adults full price; children ~60%; pets don't add venue spend */
export function partySpendMultiplier(
  adults: number,
  children: number,
  _pets = 0
): number {
  const a = Math.max(0, adults);
  const c = Math.max(0, children);
  return Math.max(1, a + c * 0.6);
}

export function resolveDayParty(
  day: TripDay,
  prefs?: { adults?: number; children?: number; pets?: number }
): { adults: number; children: number; pets: number } {
  return {
    adults: day.adults ?? prefs?.adults ?? 2,
    children: day.children ?? prefs?.children ?? 0,
    pets: day.pets ?? prefs?.pets ?? 0,
  };
}

export function estimateStopCostGbp(
  stop: Stop,
  party?: { adults: number; children: number; pets?: number }
): number {
  const base =
    stop.metadata?.estimatedCostGbp != null
      ? stop.metadata.estimatedCostGbp
      : costGbpFromPriceLevel(stop.metadata?.priceLevel);
  if (!party) return base;
  return Math.round(base * partySpendMultiplier(party.adults, party.children, party.pets));
}

export function estimateDaySpendGbp(
  day: TripDay,
  prefs?: { adults?: number; children?: number; pets?: number }
): number {
  const party = resolveDayParty(day, prefs);
  return day.stops.reduce(
    (sum, stop) => sum + estimateStopCostGbp(stop, party),
    0
  );
}

export interface DayBudget {
  dayIndex: number;
  label: string;
  estimatedSpend: number;
  budgetGbp: number;
  stopCount: number;
  overBudget: boolean;
}

export function estimateTripBudget(trip: Trip): {
  total: number;
  budgetTotal: number;
  perDay: DayBudget[];
} {
  const defaultDay =
    trip.preferences.defaultBudgetPerDay ??
    DEFAULT_BUDGET_BY_TIER[trip.preferences.budget] ??
    80;

  const perDay: DayBudget[] = trip.days.map((day) => {
    const spend = estimateDaySpendGbp(day, trip.preferences);
    // Absolute day limit; party only scales estimated spend, not the budget
    const budgetGbp = day.budgetGbp ?? defaultDay;
    return {
      dayIndex: day.dayIndex,
      label: day.label,
      estimatedSpend: spend,
      budgetGbp,
      stopCount: day.stops.length,
      overBudget: spend > budgetGbp,
    };
  });

  return {
    total: perDay.reduce((s, d) => s + d.estimatedSpend, 0),
    budgetTotal: perDay.reduce((s, d) => s + d.budgetGbp, 0),
    perDay,
  };
}

export function formatGbp(amount: number): string {
  return `£${Math.round(amount)}`;
}

export function formatInr(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

/** Dual currency label using a GBP→INR rate */
export function formatGbpInr(gbp: number, gbpToInr: number | null | undefined): string {
  const gbpLabel = formatGbp(gbp);
  if (gbpToInr == null || gbpToInr <= 0) return gbpLabel;
  return `${gbpLabel} · ${formatInr(gbp * gbpToInr)}`;
}

export function formatCurrency(amount: number, budget: string): string {
  const symbol = budget === "budget" ? "$" : budget === "luxury" ? "$$$" : "$$";
  return `${symbol}${amount}`;
}

export function getDayStatsSummary(trip: Trip) {
  return trip.days.map((day) => ({
    ...computeDayStats(day, trip.preferences.pace),
    label: day.label,
  }));
}

/** Max Google priceLevel that roughly fits remaining budget for one stop */
export function maxPriceLevelForCost(maxCostGbp: number): number {
  if (maxCostGbp <= 0) return 0;
  if (maxCostGbp < 20) return 1;
  if (maxCostGbp < 50) return 2;
  if (maxCostGbp < 90) return 3;
  return 4;
}
