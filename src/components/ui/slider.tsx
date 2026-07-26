"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

interface SliderProps {
  value: number[];
  onValueChange: (value: number[]) => void;
  onValueCommit?: (value: number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  labels?: string[];
  className?: string;
}

export function Slider({
  value,
  onValueChange,
  onValueCommit,
  min = 1,
  max = 14,
  step = 1,
  labels,
  className,
}: SliderProps) {
  return (
    <div className={cn("space-y-4", className)}>
      <SliderPrimitive.Root
        className="relative flex w-full touch-none select-none items-center"
        value={value}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        min={min}
        max={max}
        step={step ?? 1}
      >
        <SliderPrimitive.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-border">
          <SliderPrimitive.Range className="absolute h-full bg-accent" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block h-5 w-5 rounded-full border-2 border-accent bg-surface shadow-md transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-accent/30" />
      </SliderPrimitive.Root>
      {labels && (
        <div className="flex justify-between text-xs text-muted">
          {labels.map((l) => (
            <span key={l}>{l}</span>
          ))}
        </div>
      )}
    </div>
  );
}

interface SegmentedControlProps<T extends string> {
  options: Array<{ id: T; label: string; description?: string }>;
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn("grid gap-2", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }}
    >
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-xl border px-3 py-3 text-center transition-all duration-150",
            value === opt.id
              ? "border-accent bg-accent/10 text-accent shadow-sm"
              : "glass-inset border-border text-card-muted hover:border-accent/40 hover:text-card-fg"
          )}
        >
          <span className="block text-sm font-medium">{opt.label}</span>
          {opt.description && (
            <span className="mt-0.5 block text-xs opacity-70">{opt.description}</span>
          )}
        </button>
      ))}
    </div>
  );
}
