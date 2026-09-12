"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import {
  readTheme,
  subscribeTheme,
  writeTheme,
  type Theme,
} from "@/components/theme/theme-store";
import { cn } from "@/lib/utils";

// A single cycling button rather than three: the header is deliberately tight
// (see DashboardFilters), and the icon already names the current state.
const ORDER: Theme[] = ["light", "dark", "system"];

const META: Record<
  Theme,
  { icon: typeof SunIcon; label: string }
> = {
  light: { icon: SunIcon, label: "Light" },
  dark: { icon: MoonIcon, label: "Dark" },
  system: { icon: MonitorIcon, label: "System" },
};

export function ThemeToggle({ className }: { className?: string }) {
  // Server snapshot is "system", matching the SSR HTML. The blocking script in
  // the root layout has already painted the right palette by then; this only
  // decides which icon to show once hydrated.
  const theme = useSyncExternalStore(
    subscribeTheme,
    readTheme,
    () => "system" as Theme,
  );
  const next = ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length];
  const Icon = META[theme].icon;

  return (
    <button
      type="button"
      onClick={() => writeTheme(next)}
      title={`Theme: ${META[theme].label} — switch to ${META[next].label}`}
      aria-label={`Theme: ${META[theme].label}. Switch to ${META[next].label}.`}
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-input text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}
