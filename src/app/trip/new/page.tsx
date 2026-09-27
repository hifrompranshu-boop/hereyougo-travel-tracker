"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Header } from "@/components/layout/header";
import { TripWizard } from "@/components/wizard/trip-wizard";
import { saveTrip } from "@/lib/db/local";
import { syncTripToCloud } from "@/lib/sync/cloud";
import type { WizardFormData, Trip } from "@/lib/types/trip";

export default function NewTripPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genPhase, setGenPhase] = useState(0);
  const genPhases = ["Finding places…", "Optimizing routes…", "Balancing your days…"];

  const handleComplete = async (formData: WizardFormData) => {
    setGenerating(true);
    setError(null);

    const phaseInterval = setInterval(() => {
      setGenPhase((p) => (p + 1) % genPhases.length);
    }, 2500);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Generation failed");
      }

      const { trip } = (await res.json()) as { trip: Trip };
      await saveTrip(trip);

      // If signed in (Clerk session cookie), attach to account immediately
      let next = trip;
      try {
        next = await syncTripToCloud(trip);
        await saveTrip(next);
      } catch {
        // Guest or sync unavailable — local save is enough
      }

      router.push(`/trip/${next.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setGenerating(false);
    } finally {
      clearInterval(phaseInterval);
    }
  };

  if (generating) {
    return (
      <>
        <Header />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-4">
          <div className="relative h-16 w-16">
            <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          </div>
          <div className="text-center">
            <p className="font-display text-lg font-medium text-foreground">
              Creating your itinerary
            </p>
            <p className="mt-2 text-sm text-muted">{genPhases[genPhase]}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      {error && (
        <div className="mx-auto mt-4 max-w-[560px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}
      <TripWizard onComplete={handleComplete} />
    </>
  );
}
