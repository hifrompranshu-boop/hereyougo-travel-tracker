/**
 * Daily GBP → INR rate via Frankfurter (ECB data, no API key).
 * Cached in-memory for the process and optionally by date key.
 */

export interface ForexQuote {
  from: "GBP";
  to: "INR";
  rate: number;
  date: string;
  source: string;
}

const FALLBACK_RATE = 105;
let memoryCache: { key: string; quote: ForexQuote } | null = null;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchGbpToInrRate(date?: string): Promise<ForexQuote> {
  const key = date ?? todayKey();
  if (memoryCache?.key === key) return memoryCache.quote;

  try {
    const url =
      key === todayKey()
        ? "https://api.frankfurter.app/latest?from=GBP&to=INR"
        : `https://api.frankfurter.app/${key}?from=GBP&to=INR`;

    const res = await fetch(url, { cache: "force-cache" });
    if (!res.ok) throw new Error(`Forex HTTP ${res.status}`);
    const data = (await res.json()) as {
      date?: string;
      rates?: { INR?: number };
    };
    const rate = data.rates?.INR;
    if (typeof rate !== "number" || rate <= 0) throw new Error("Invalid rate");

    const quote: ForexQuote = {
      from: "GBP",
      to: "INR",
      rate,
      date: data.date ?? key,
      source: "frankfurter",
    };
    memoryCache = { key, quote };
    return quote;
  } catch (error) {
    console.warn("GBP→INR forex fetch failed, using fallback:", error);
    const quote: ForexQuote = {
      from: "GBP",
      to: "INR",
      rate: FALLBACK_RATE,
      date: key,
      source: "fallback",
    };
    memoryCache = { key, quote };
    return quote;
  }
}

export function gbpToInr(gbp: number, rate: number): number {
  return gbp * rate;
}
