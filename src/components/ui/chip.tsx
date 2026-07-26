"use client";

import { cn } from "@/lib/utils";

interface ChipProps {
  label: string;
  selected?: boolean;
  onClick?: () => void;
  icon?: string;
  disabled?: boolean;
  className?: string;
}

export function Chip({
  label,
  selected,
  onClick,
  icon,
  disabled,
  className,
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-all duration-150",
        selected
          ? "border-accent bg-accent/10 text-accent shadow-sm"
          : "glass-inset border-border text-card-fg hover:border-accent/40 hover:bg-accent/5",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {icon && <span className="text-base leading-none">{icon}</span>}
      {label}
    </button>
  );
}

interface ChipGroupProps {
  options: Array<{ id: string; label: string; icon?: string }>;
  selected: string[];
  onChange: (selected: string[]) => void;
  max?: number;
  className?: string;
}

export function ChipGroup({
  options,
  selected,
  onChange,
  max,
  className,
}: ChipGroupProps) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Keep at least one when max === 1 (single-select chips)
      if (max === 1) return;
      onChange(selected.filter((s) => s !== id));
    } else if (max === 1) {
      onChange([id]);
    } else if (!max || selected.length < max) {
      onChange([...selected, id]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => (
        <Chip
          key={opt.id}
          label={opt.label}
          icon={opt.icon}
          selected={selected.includes(opt.id)}
          onClick={() => toggle(opt.id)}
          disabled={
            max !== undefined &&
            max > 1 &&
            !selected.includes(opt.id) &&
            selected.length >= max
          }
        />
      ))}
    </div>
  );
}
