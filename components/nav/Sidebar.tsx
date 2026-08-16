"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  FlameIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
  SettingsIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/", label: "Tasks", icon: ListChecksIcon },
  { href: "/streaks", label: "Streaks", icon: FlameIcon },
  { href: "/categories", label: "Categories", icon: SettingsIcon },
] as const;

const STORAGE_KEY = "timeflow-sidebar-collapsed";

// Tiny external store for the collapsed preference. useSyncExternalStore keeps
// hydration safe (the server snapshot is always "expanded", matching the SSR
// HTML) without a setState-in-effect cascade after mount.
let collapsedCache: boolean | null = null;
const listeners = new Set<() => void>();

function readCollapsed(): boolean {
  if (collapsedCache === null) {
    collapsedCache = localStorage.getItem(STORAGE_KEY) === "1";
  }
  return collapsedCache;
}

function writeCollapsed(next: boolean) {
  collapsedCache = next;
  localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  return (
    <aside
      className={cn(
        "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200",
        // Below sm the sidebar is always a narrow icon rail — a 224px panel
        // would eat half a phone screen. The expand toggle only exists from sm.
        collapsed ? "w-14" : "w-14 sm:w-56",
      )}
    >
      <div className="hidden items-center gap-2 px-3 py-2.5 sm:flex">
        {!collapsed && (
          <span className="flex-1 truncate text-lg font-semibold text-primary">
            TimeFlow
          </span>
        )}
        <button
          type="button"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => writeCollapsed(!collapsed)}
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
            collapsed && "mx-auto",
          )}
        >
          {collapsed ? (
            <PanelLeftOpenIcon className="size-4" />
          ) : (
            <PanelLeftCloseIcon className="size-4" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2 py-2">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={cn(
                "flex items-center gap-2 rounded-lg py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                // Icon-only below sm (and when collapsed); icon + label from sm up.
                collapsed
                  ? "justify-center px-0"
                  : "justify-center px-0 sm:justify-start sm:px-2.5",
              )}
            >
              <Icon
                className={cn("size-4 shrink-0", active && "text-primary")}
              />
              {!collapsed && (
                <span className="hidden truncate sm:inline">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
