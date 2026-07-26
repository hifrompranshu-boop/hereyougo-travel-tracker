"use client";

import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { Trip } from "@/lib/types/trip";
import { computeDayStats } from "@/lib/time/engine";
import { formatMinutes } from "@/lib/utils";

interface OptimizeDialogProps {
  trip: Trip;
  onConfirm: () => void;
  onClose: () => void;
}

export function OptimizeDialog({ trip, onConfirm, onClose }: OptimizeDialogProps) {
  return (
    <Dialog open onOpenChange={() => onClose()}>
      <DialogContent title="Optimize all days">
        <p className="mt-2 text-sm text-card-muted">
          Reorder stops within each day to minimize travel time and backtracking.
        </p>
        <div className="mt-4 space-y-2">
          {trip.days.map((day) => {
            const stats = computeDayStats(day, trip.preferences.pace);
            return (
              <div
                key={day.id}
                className="glass-inset flex items-center justify-between rounded-lg px-3 py-2 text-sm text-card-fg"
              >
                <span>{day.label}</span>
                <span className="tabular-nums text-card-muted">
                  {day.stops.length} stops · {formatMinutes(stats.travelMinutes)} travel
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} className="flex-1">
            Optimize
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
