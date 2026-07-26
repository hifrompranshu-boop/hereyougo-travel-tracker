import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Coffee,
  Landmark,
  MapPin,
  Moon,
  Mountain,
  ShoppingBag,
  Theater,
  Trees,
  TrainFront,
  Utensils,
  Waves,
} from "lucide-react";

/** Soft tint over place photos — never fully opaque */
export interface CategoryStyle {
  /** Tailwind gradient for the soft color wash */
  overlay: string;
  /** Accent chip / icon well */
  accent: string;
  Icon: LucideIcon;
}

const DEFAULT: CategoryStyle = {
  overlay:
    "from-teal-950/55 via-teal-900/35 to-black/55 dark:from-teal-950/50 dark:via-teal-900/30 dark:to-black/60",
  accent: "bg-teal-500/25 text-teal-50",
  Icon: MapPin,
};

const STYLES: Array<{ match: RegExp; style: CategoryStyle }> = [
  {
    match: /museum|gallery|art|culture/,
    style: {
      overlay:
        "from-violet-950/55 via-violet-900/30 to-black/55 dark:from-violet-950/50 dark:via-violet-900/28 dark:to-black/60",
      accent: "bg-violet-400/25 text-violet-50",
      Icon: Building2,
    },
  },
  {
    match: /restaurant|food|dining/,
    style: {
      overlay:
        "from-orange-950/55 via-orange-900/30 to-black/55 dark:from-orange-950/50 dark:via-orange-900/28 dark:to-black/60",
      accent: "bg-orange-400/25 text-orange-50",
      Icon: Utensils,
    },
  },
  {
    match: /cafe|coffee/,
    style: {
      overlay:
        "from-amber-950/50 via-amber-900/28 to-black/55 dark:from-amber-950/45 dark:via-amber-900/25 dark:to-black/60",
      accent: "bg-amber-400/25 text-amber-50",
      Icon: Coffee,
    },
  },
  {
    match: /park|garden|nature/,
    style: {
      overlay:
        "from-emerald-950/55 via-emerald-900/30 to-black/55 dark:from-emerald-950/50 dark:via-emerald-900/28 dark:to-black/60",
      accent: "bg-emerald-400/25 text-emerald-50",
      Icon: Trees,
    },
  },
  {
    match: /beach|coast|sea/,
    style: {
      overlay:
        "from-sky-950/55 via-sky-900/30 to-black/55 dark:from-sky-950/50 dark:via-sky-900/28 dark:to-black/60",
      accent: "bg-sky-400/25 text-sky-50",
      Icon: Waves,
    },
  },
  {
    match: /shop|market/,
    style: {
      overlay:
        "from-rose-950/50 via-rose-900/28 to-black/55 dark:from-rose-950/45 dark:via-rose-900/25 dark:to-black/60",
      accent: "bg-rose-400/25 text-rose-50",
      Icon: ShoppingBag,
    },
  },
  {
    match: /night|bar|club|lounge/,
    style: {
      overlay:
        "from-indigo-950/55 via-indigo-900/32 to-black/55 dark:from-indigo-950/50 dark:via-indigo-900/30 dark:to-black/60",
      accent: "bg-indigo-400/25 text-indigo-50",
      Icon: Moon,
    },
  },
  {
    match: /landmark|monument|tower/,
    style: {
      overlay:
        "from-slate-950/55 via-slate-800/30 to-black/55 dark:from-slate-950/50 dark:via-slate-800/28 dark:to-black/60",
      accent: "bg-slate-300/25 text-slate-50",
      Icon: Landmark,
    },
  },
  {
    match: /mountain|hike|trail/,
    style: {
      overlay:
        "from-lime-950/55 via-lime-900/28 to-black/55 dark:from-lime-950/50 dark:via-lime-900/25 dark:to-black/60",
      accent: "bg-lime-400/25 text-lime-50",
      Icon: Mountain,
    },
  },
  {
    match: /transit|train|station/,
    style: {
      overlay:
        "from-cyan-950/55 via-cyan-900/28 to-black/55 dark:from-cyan-950/50 dark:via-cyan-900/25 dark:to-black/60",
      accent: "bg-cyan-400/25 text-cyan-50",
      Icon: TrainFront,
    },
  },
  {
    match: /theater|theatre|show|performance/,
    style: {
      overlay:
        "from-fuchsia-950/55 via-fuchsia-900/28 to-black/55 dark:from-fuchsia-950/50 dark:via-fuchsia-900/25 dark:to-black/60",
      accent: "bg-fuchsia-400/25 text-fuchsia-50",
      Icon: Theater,
    },
  },
];

export function getCategoryStyle(category: string): CategoryStyle {
  const key = category.toLowerCase();
  for (const entry of STYLES) {
    if (entry.match.test(key)) return entry.style;
  }
  return DEFAULT;
}
