"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  MapPin,
  Plus,
  Search,
  TrainFront,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import {
  cascadeCityDates,
  defaultTransit,
  emptyCity,
} from "@/lib/trip/cities";
import type { CityTransitPlan, WizardCity } from "@/lib/types/trip";
import { cn } from "@/lib/utils";

interface CitiesStepProps {
  cities: WizardCity[];
  onChange: (cities: WizardCity[]) => void;
}

type Suggestion = { placeId: string; name: string; lat: number; lng: number };

export function CitiesStep({ cities, onChange }: CitiesStepProps) {
  const setCities = (next: WizardCity[], cascade = true) => {
    onChange(cascade ? cascadeCityDates(next) : next);
  };

  const updateCity = (id: string, patch: Partial<WizardCity>, cascade = true) => {
    setCities(
      cities.map((c) => (c.id === id ? { ...c, ...patch } : c)),
      cascade
    );
  };

  const addCity = () => {
    const last = cities[cities.length - 1];
    const withTransit = cities.map((c, i) =>
      i === cities.length - 1
        ? { ...c, transitToNext: c.transitToNext ?? defaultTransit() }
        : c
    );
    setCities([
      ...withTransit,
      emptyCity({
        arrivalDate: last?.arrivalDate,
        arrivalTime: "14:00",
        numDays: 2,
      }),
    ]);
  };

  const removeCity = (id: string) => {
    if (cities.length <= 1) return;
    const filtered = cities.filter((c) => c.id !== id);
    // Drop transit on new last city
    const normalized = filtered.map((c, i) =>
      i === filtered.length - 1 ? { ...c, transitToNext: undefined } : c
    );
    setCities(normalized);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
          Your cities
        </h2>
        <p className="mt-2 text-muted">
          Tickets are already booked — add each city, when you land, and how long you stay.
          Between cities, set a transit window or your exact departure.
        </p>
      </div>

      <div className="space-y-6">
        {cities.map((city, index) => (
          <div key={city.id} className="space-y-4">
            <CityCard
              index={index}
              city={city}
              canRemove={cities.length > 1}
              onChange={(patch, cascade) => updateCity(city.id, patch, cascade)}
              onRemove={() => removeCity(city.id)}
            />

            {index < cities.length - 1 && (
              <TransitCard
                fromName={city.name || `City ${index + 1}`}
                toName={cities[index + 1]?.name || `City ${index + 2}`}
                transit={city.transitToNext ?? defaultTransit()}
                onChange={(transit) =>
                  updateCity(city.id, { transitToNext: transit }, true)
                }
              />
            )}
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="secondary"
        onClick={addCity}
        className="w-full border-[var(--border-strong)] text-foreground dark:border-white/25 dark:bg-[#1e262e] dark:text-white"
      >
        <Plus className="h-4 w-4" strokeWidth={2.4} />
        Add another city
      </Button>
    </div>
  );
}

function CityCard({
  index,
  city,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  city: WizardCity;
  canRemove: boolean;
  onChange: (patch: Partial<WizardCity>, cascade?: boolean) => void;
  onRemove: () => void;
}) {
  const [query, setQuery] = useState(city.name);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const skipRef = useRef(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (city.name !== query) {
      setQuery(city.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when parent city name changes externally
  }, [city.name]);

  useEffect(() => {
    if (skipRef.current) {
      skipRef.current = false;
      setSuggestions([]);
      return;
    }
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/places/search?q=${encodeURIComponent(query)}`,
          { signal: ac.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(
          (data.places ?? []).map(
            (p: { placeId: string; name: string; lat: number; lng: number }) => ({
              placeId: p.placeId,
              name: p.name,
              lat: p.lat,
              lng: p.lng,
            })
          )
        );
        setFocused(true);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.error("City search failed", err);
        }
      }
    }, 280);
    return () => {
      clearTimeout(timer);
      ac.abort();
    };
  }, [query]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setSuggestions([]);
        setFocused(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="glass-card glass-card-accent rounded-2xl p-4">
      <div className="relative z-[1] mb-4 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-card-fg">
          City {index + 1}
          {city.name ? (
            <span className="font-normal text-card-muted"> · {city.name}</span>
          ) : null}
        </p>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="rounded-lg p-2 text-foreground/70 hover:bg-red-50 hover:text-red-600 dark:text-foreground/85 dark:hover:bg-red-950/40 dark:hover:text-red-400"
            aria-label="Remove city"
          >
            <Trash2 className="h-4 w-4" strokeWidth={2.25} />
          </button>
        )}
      </div>

      <div className="relative z-[1] space-y-4">
        <div className="relative" ref={wrapRef}>
          <label className="mb-2 block text-sm font-medium text-card-fg">
            Destination
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-accent dark:text-[#99f6e4]"
              strokeWidth={2.5}
              aria-hidden
            />
            <input
              value={query}
              onFocus={() => setFocused(true)}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
                if (v.trim().length >= 2) {
                  onChange({ name: v.trim(), placeId: "" }, false);
                } else {
                  onChange({ name: "", placeId: "" }, false);
                }
              }}
              placeholder="e.g. Paris, Dubai, Tokyo"
              className="glass-inset flex h-11 w-full rounded-xl pl-10 pr-4 text-sm text-card-fg placeholder:text-card-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              autoComplete="off"
            />
          </div>
          {focused && suggestions.length > 0 && (
            <ul
              role="listbox"
              className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-stone-300 bg-white py-1 shadow-2xl ring-1 ring-black/10 dark:border-white/30 dark:bg-[#36424e] dark:shadow-[0_12px_40px_rgba(0,0,0,0.75)] dark:ring-white/20"
            >
              {suggestions.map((s) => (
                <li key={s.placeId} role="option">
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      skipRef.current = true;
                      setQuery(s.name);
                      setSuggestions([]);
                      setFocused(false);
                      onChange(
                        {
                          name: s.name,
                          placeId: s.placeId,
                          lat: s.lat,
                          lng: s.lng,
                        },
                        false
                      );
                    }}
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm text-stone-900 transition-colors hover:bg-teal-50 focus-visible:bg-teal-50 focus-visible:outline-none dark:text-white dark:hover:bg-white/12 dark:focus-visible:bg-white/12"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white dark:bg-teal-400 dark:text-[#0f172a]">
                      <MapPin className="h-4 w-4" strokeWidth={2.5} />
                    </span>
                    <span className="min-w-0 flex-1 font-medium leading-snug">
                      {s.name}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={index === 0 ? "Landing date" : "Arrival date"}
            type="date"
            value={city.arrivalDate}
            onChange={(e) => onChange({ arrivalDate: e.target.value }, true)}
          />
          <Input
            label={index === 0 ? "Landing time" : "Arrival time"}
            type="time"
            value={city.arrivalTime}
            onChange={(e) => onChange({ arrivalTime: e.target.value }, false)}
          />
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Days in this city</label>
            <span className="text-sm font-medium text-accent">{city.numDays}</span>
          </div>
          <Slider
            value={[city.numDays]}
            onValueChange={([v]) => onChange({ numDays: v }, true)}
            min={1}
            max={14}
            labels={["1 day", "14 days"]}
          />
        </div>
      </div>
    </div>
  );
}

function TransitCard({
  fromName,
  toName,
  transit,
  onChange,
}: {
  fromName: string;
  toName: string;
  transit: CityTransitPlan;
  onChange: (t: CityTransitPlan) => void;
}) {
  return (
    <div className="glass-card glass-card-accent relative rounded-2xl border-dashed px-4 py-4">
      <div className="relative z-[1] mb-3 flex items-center gap-2 text-sm font-medium text-card-fg">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent dark:bg-accent/25 dark:text-[#5eead4]">
          <TrainFront className="h-4 w-4" strokeWidth={2.25} />
        </span>
        <span className="truncate">{fromName}</span>
        <ArrowRight className="h-3.5 w-3.5 shrink-0 text-foreground/60 dark:text-foreground/75" />
        <span className="truncate">{toName}</span>
      </div>
      <p className="relative z-[1] mb-4 text-xs text-card-muted">
        How are you getting between these cities?
      </p>

      <div className="glass-inset relative z-[1] mb-4 inline-flex rounded-full p-1">
        {(
          [
            { id: "flexible" as const, label: "Max hours" },
            { id: "booked" as const, label: "Exact departure" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange({ ...transit, type: opt.id })}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              transit.type === opt.id
                ? "bg-accent text-white"
                : "text-muted hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {transit.type === "flexible" ? (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-foreground">Max transit time</span>
            <span className="text-sm font-medium text-accent">{transit.maxHours}h</span>
          </div>
          <Slider
            value={[transit.maxHours]}
            onValueChange={([v]) => onChange({ ...transit, maxHours: v })}
            min={1}
            max={12}
            step={0.5}
            labels={["1h", "12h"]}
          />
          <p className="mt-2 text-xs text-muted">
            We&apos;ll keep the transfer under this window on your transit day.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Input
            label="Departure time"
            type="time"
            value={transit.departTime}
            onChange={(e) => onChange({ ...transit, departTime: e.target.value })}
          />
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm text-foreground">Journey duration</span>
              <span className="text-sm font-medium text-accent">
                {transit.durationHours}h
              </span>
            </div>
            <Slider
              value={[transit.durationHours]}
              onValueChange={([v]) => onChange({ ...transit, durationHours: v })}
              min={1}
              max={12}
              step={0.5}
              labels={["1h", "12h"]}
            />
            <p className="mt-2 text-xs text-muted">
              Use this when you already know the train/flight length.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
