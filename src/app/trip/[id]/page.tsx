"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { KanbanBoard } from "@/components/board/kanban-board";
import { Button } from "@/components/ui/button";
import { getTrip } from "@/lib/db/local";
import type { Trip } from "@/lib/types/trip";

export default function TripBoardPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrip(id).then((t) => {
      if (!t) {
        router.push("/");
        return;
      }
      setTrip(t);
      setLoading(false);
    });
  }, [id, router]);

  if (loading || !trip) {
    return (
      <>
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </>
    );
  }

  return (
    <>
      <Header />
      <KanbanBoard initialTrip={trip} onTripChange={setTrip} />
    </>
  );
}
