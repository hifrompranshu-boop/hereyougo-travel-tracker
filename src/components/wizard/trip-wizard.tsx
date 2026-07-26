"use client";

import { useCallback, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChipGroup } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { SegmentedControl, Slider } from "@/components/ui/slider";
import { CitiesStep } from "@/components/wizard/cities-step";
import {
  AVOID_OPTIONS,
  BUDGET_OPTIONS,
  INTERESTS,
  MOBILITY_OPTIONS,
  PACE_OPTIONS,
  TRAVEL_STYLES,
} from "@/lib/constants";
import {
  DAY_BUDGET_MAX,
  DAY_BUDGET_MIN,
  DEFAULT_BUDGET_BY_TIER,
  formatGbp,
} from "@/lib/export/budget";
import { deriveWizardMeta, emptyCity } from "@/lib/trip/cities";
import type { Budget, Mobility, Pace, WizardFormData } from "@/lib/types/trip";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STEPS = ["Cities", "Style", "Interests", "Review"];

function buildDefaultForm(initial?: Partial<WizardFormData>): WizardFormData {
  const cities =
    initial?.cities && initial.cities.length > 0
      ? initial.cities
      : [
          emptyCity({
            name: initial?.destinationName ?? "",
            placeId: initial?.destinationPlaceId ?? "",
            lat: initial?.destinationLat,
            lng: initial?.destinationLng,
            arrivalDate: initial?.startDate ?? format(new Date(), "yyyy-MM-dd"),
            arrivalTime: initial?.dayStartTime ?? "10:00",
            numDays: initial?.numDays ?? 3,
          }),
        ];
  const meta = deriveWizardMeta(cities);
  return {
    cities,
    ...meta,
    dayEndTime: initial?.dayEndTime ?? "21:00",
    pace: initial?.pace ?? "moderate",
    budget: initial?.budget ?? "mid",
    defaultBudgetPerDay:
      initial?.defaultBudgetPerDay ??
      DEFAULT_BUDGET_BY_TIER[initial?.budget ?? "mid"],
    travelStyles: initial?.travelStyles ?? [],
    mobility: initial?.mobility ?? "walk",
    interests: initial?.interests ?? [],
    mustInclude: initial?.mustInclude ?? [],
    avoid: initial?.avoid ?? [],
    freeTextNotes: initial?.freeTextNotes ?? "",
    adults: initial?.adults ?? 2,
    children: initial?.children ?? 0,
    pets: initial?.pets ?? 0,
  };
}

interface TripWizardProps {
  onComplete: (data: WizardFormData) => void;
  initialData?: Partial<WizardFormData>;
}

export function TripWizard({ onComplete, initialData }: TripWizardProps) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<WizardFormData>(() => buildDefaultForm(initialData));
  const [showNotes, setShowNotes] = useState(false);
  const [mustIncludeText, setMustIncludeText] = useState(() =>
    (initialData?.mustInclude ?? []).join(", ")
  );

  const update = useCallback(
    <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const setCities = useCallback((cities: WizardFormData["cities"]) => {
    const meta = deriveWizardMeta(cities);
    setForm((prev) => ({ ...prev, cities, ...meta }));
  }, []);

  const bumpParty = (key: "adults" | "children" | "pets", delta: number) => {
    const min = key === "adults" ? 1 : 0;
    update(key, Math.min(20, Math.max(min, form[key] + delta)));
  };

  const citiesValid = useMemo(
    () =>
      form.cities.length > 0 &&
      form.cities.every(
        (c) => c.name.trim().length >= 2 && c.numDays >= 1 && c.arrivalDate && c.arrivalTime
      ),
    [form.cities]
  );

  const canContinue = () => {
    if (step === 0) return citiesValid && form.adults >= 1;
    if (step === 1) return form.travelStyles.length > 0;
    if (step === 2) return form.interests.length > 0;
    return true;
  };

  const handleGenerate = () => {
    const meta = deriveWizardMeta(form.cities);
    onComplete({ ...form, ...meta });
  };

  return (
    <div
      className="mx-auto w-full max-w-[560px] px-4 pb-32 pt-8"
      data-wizard-step={step}
    >
      <div className="mb-10 flex justify-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors",
                i <= step ? "bg-accent text-white" : "bg-border text-muted"
              )}
            >
              {i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div className={cn("h-0.5 w-6", i < step ? "bg-accent" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      <div className="space-y-8 text-foreground">
        {step === 0 && (
          <>
            <CitiesStep cities={form.cities} onChange={setCities} />
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Who&apos;s going?
              </label>
              <div className="grid grid-cols-3 gap-3">
                <PartyCounter
                  label="Adults"
                  value={form.adults}
                  onDec={() => bumpParty("adults", -1)}
                  onInc={() => bumpParty("adults", 1)}
                />
                <PartyCounter
                  label="Children"
                  value={form.children}
                  onDec={() => bumpParty("children", -1)}
                  onInc={() => bumpParty("children", 1)}
                />
                <PartyCounter
                  label="Pets"
                  value={form.pets}
                  onDec={() => bumpParty("pets", -1)}
                  onInc={() => bumpParty("pets", 1)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Daily exploring from"
                type="time"
                value={form.dayStartTime}
                onChange={(e) => update("dayStartTime", e.target.value)}
              />
              <Input
                label="Until"
                type="time"
                value={form.dayEndTime}
                onChange={(e) => update("dayEndTime", e.target.value)}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                What&apos;s your travel style?
              </h2>
              <p className="mt-2 text-muted">Help us match the vibe of your trip</p>
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">Pace</label>
              <SegmentedControl
                options={PACE_OPTIONS.map((p) => ({
                  id: p.id as Pace,
                  label: p.label,
                  description: p.description,
                }))}
                value={form.pace}
                onChange={(v) => update("pace", v)}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">Budget</label>
              <ChipGroup
                options={BUDGET_OPTIONS.map((b) => ({ id: b.id, label: b.label }))}
                selected={[form.budget]}
                onChange={([v]) => {
                  const tier = v as Budget;
                  setForm((prev) => ({
                    ...prev,
                    budget: tier,
                    defaultBudgetPerDay: DEFAULT_BUDGET_BY_TIER[tier],
                  }));
                }}
                max={1}
              />
            </div>
            <div>
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Default spend per day
                </label>
                <span className="text-sm font-semibold tabular-nums text-accent">
                  {formatGbp(form.defaultBudgetPerDay)}
                </span>
              </div>
              <p className="mb-3 text-xs text-muted">
                Estimated activities & meals in GBP. You can tweak each day later on the board.
              </p>
              <Slider
                value={[form.defaultBudgetPerDay]}
                onValueChange={([v]) => update("defaultBudgetPerDay", v)}
                min={DAY_BUDGET_MIN}
                max={DAY_BUDGET_MAX}
                step={5}
                labels={[formatGbp(DAY_BUDGET_MIN), formatGbp(DAY_BUDGET_MAX)]}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Travel styles
              </label>
              <ChipGroup
                options={TRAVEL_STYLES.map((s) => ({ id: s, label: s }))}
                selected={form.travelStyles}
                onChange={(v) => update("travelStyles", v)}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">Getting around</label>
              <ChipGroup
                options={MOBILITY_OPTIONS.map((m) => ({ id: m.id, label: m.label }))}
                selected={[form.mobility]}
                onChange={([v]) => update("mobility", v as Mobility)}
                max={1}
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                What interests you?
              </h2>
              <p className="mt-2 text-muted">Pick categories that excite you</p>
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">Interests</label>
              <ChipGroup
                options={INTERESTS.map((i) => ({
                  id: i.id,
                  label: i.label,
                  icon: i.icon,
                }))}
                selected={form.interests}
                onChange={(v) => update("interests", v)}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">
                Must-include (optional, up to 3)
              </label>
              <Input
                placeholder="e.g. Eiffel Tower, specific restaurant"
                value={mustIncludeText}
                onChange={(e) => {
                  const raw = e.target.value;
                  setMustIncludeText(raw);
                  update(
                    "mustInclude",
                    raw
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .slice(0, 3)
                  );
                }}
              />
            </div>
            <div>
              <label className="mb-3 block text-sm font-medium text-foreground">Avoid</label>
              <ChipGroup
                options={AVOID_OPTIONS.map((a) => ({ id: a, label: a }))}
                selected={form.avoid}
                onChange={(v) => update("avoid", v)}
              />
            </div>
            <button
              type="button"
              onClick={() => setShowNotes(!showNotes)}
              className="text-sm text-accent hover:underline"
            >
              {showNotes ? "Hide" : "Add"} specific notes (optional)
            </button>
            {showNotes && (
              <Textarea
                placeholder="e.g. vegetarian restaurants, kid-friendly"
                value={form.freeTextNotes}
                onChange={(e) => update("freeTextNotes", e.target.value)}
              />
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-foreground">
                Ready to explore?
              </h2>
              <p className="mt-2 text-muted">Review your multi-city plan</p>
            </div>
            <div className="glass-card relative z-0 space-y-4 rounded-2xl p-6">
              <SummaryRow label="Route" value={form.destinationName || "—"} />
              <SummaryRow label="Total days" value={`${form.numDays} days`} />
              {form.cities.map((c, i) => (
                <SummaryRow
                  key={c.id}
                  label={`City ${i + 1}`}
                  value={`${c.name || "—"} · ${c.numDays}d · land ${c.arrivalDate} ${c.arrivalTime}`}
                />
              ))}
              <SummaryRow
                label="Party"
                value={`${form.adults} adults · ${form.children} children · ${form.pets} pets`}
              />
              <SummaryRow label="Pace" value={form.pace} />
              <SummaryRow
                label="Budget"
                value={`${form.budget} · ${formatGbp(form.defaultBudgetPerDay)}/day`}
              />
              <SummaryRow label="Styles" value={form.travelStyles.join(", ") || "—"} />
              <SummaryRow label="Interests" value={`${form.interests.length} selected`} />
            </div>
          </>
        )}
      </div>

      <div className="glass-panel fixed bottom-0 left-0 right-0 z-50 border-t border-border/80">
        <div className="mx-auto flex max-w-[560px] items-center justify-between gap-4 px-4 py-4">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>
          {step < STEPS.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canContinue()}
            >
              Continue
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button type="button" onClick={handleGenerate} disabled={!canContinue()}>
              Generate itinerary
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function PartyCounter({
  label,
  value,
  onDec,
  onInc,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
}) {
  return (
    <div className="glass-inset rounded-xl px-3 py-3">
      <p className="mb-2 text-xs font-medium text-card-muted">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDec}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent/10"
          aria-label={`Decrease ${label}`}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <span className="min-w-[1.5rem] text-center text-base font-semibold tabular-nums">
          {value}
        </span>
        <button
          type="button"
          onClick={onInc}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent/10"
          aria-label={`Increase ${label}`}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <span className="shrink-0 text-card-muted">{label}</span>
      <span className="text-right font-medium capitalize text-card-fg">{value}</span>
    </div>
  );
}
