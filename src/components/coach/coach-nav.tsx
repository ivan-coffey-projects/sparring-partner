"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/coach", label: "Dashboard" },
  { href: "/coach/prospects", label: "Prospects" },
  { href: "/coach/methodology", label: "Methodology" },
  { href: "/coach/scorecards", label: "Scorecards" },
  { href: "/coach/drills", label: "Drills" },
  { href: "/coach/settings", label: "Settings" },
];

export function CoachNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-full bg-background p-1">
      {TABS.map((tab) => {
        const active =
          tab.href === "/coach"
            ? pathname === "/coach"
            : pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "whitespace-nowrap rounded-full px-3 py-2 text-[11px] font-semibold tracking-[0.04em] uppercase transition-colors",
              active
                ? "bg-glow text-background"
                : "text-foreground/65 hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
