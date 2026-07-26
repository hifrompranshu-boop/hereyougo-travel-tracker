"use client";

import Link from "next/link";
import { Compass, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-provider";

export function Header() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === "dark";

  return (
    <header className="glass-panel relative z-40 border-b border-border/80">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" prefetch={false}>
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/15 shadow-sm">
            <Compass className="h-5 w-5 text-accent" />
          </div>
          <span className="font-display text-lg font-semibold tracking-tight text-foreground">
            Voyage
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-xl p-2 text-muted transition-colors hover:bg-accent/10 hover:text-foreground"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <span className="text-xs text-muted">Guest mode</span>
        </div>
      </div>
    </header>
  );
}
