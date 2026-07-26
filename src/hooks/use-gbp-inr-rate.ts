"use client";

import { useEffect, useState } from "react";

export function useGbpToInrRate(date?: string) {
  const [rate, setRate] = useState<number | null>(null);
  const [rateDate, setRateDate] = useState<string | null>(null);

  useEffect(() => {
    const params = date ? `?date=${encodeURIComponent(date)}` : "";
    let cancelled = false;
    fetch(`/api/forex${params}`)
      .then((r) => r.json())
      .then((data: { rate?: number; date?: string }) => {
        if (cancelled) return;
        if (typeof data.rate === "number") {
          setRate(data.rate);
          setRateDate(data.date ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setRate(105);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  return { rate, rateDate };
}
