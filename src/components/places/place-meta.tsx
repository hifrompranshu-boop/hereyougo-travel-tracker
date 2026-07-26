"use client";

import { Star } from "lucide-react";
import { formatGbpInr } from "@/lib/export/budget";
import { formatPriceLevel } from "@/lib/time/hours";
import { cn } from "@/lib/utils";

interface PlaceMetaProps {
  rating?: number | null;
  priceLevel?: number | null;
  estimatedCostGbp?: number | null;
  gbpToInr?: number | null;
  className?: string;
  size?: "sm" | "md";
  showCost?: boolean;
}

export function PlaceMeta({
  rating,
  priceLevel,
  estimatedCostGbp,
  gbpToInr,
  className,
  size = "sm",
  showCost = true,
}: PlaceMetaProps) {
  const priceLabel = formatPriceLevel(priceLevel ?? undefined);
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  if (rating == null && !priceLabel && estimatedCostGbp == null) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {rating != null && (
        <span
          className={cn(
            "inline-flex items-center gap-0.5 font-medium text-card-fg",
            textSize
          )}
        >
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          {rating.toFixed(1)}
        </span>
      )}
      {priceLabel && (
        <span className={cn("font-medium text-card-muted", textSize)}>{priceLabel}</span>
      )}
      {showCost && estimatedCostGbp != null && estimatedCostGbp > 0 && (
        <span className={cn("tabular-nums text-card-muted", textSize)}>
          {formatGbpInr(estimatedCostGbp, gbpToInr)}
        </span>
      )}
    </div>
  );
}
