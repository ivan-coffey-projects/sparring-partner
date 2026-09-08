"use client";

import { patienceBand } from "@/engine/patience";
import { cn } from "@/lib/utils";

const BAND_STYLES = {
  engaged: { fill: "bg-glow", text: "text-glow", label: "Engaged" },
  cooling: { fill: "bg-amber-400", text: "text-amber-400", label: "Cooling" },
  impatient: { fill: "bg-red-500", text: "text-red-400", label: "Impatient" },
  done: { fill: "bg-red-800", text: "text-red-500", label: "Gone" },
} as const;

const SEGMENTS = 12;

export function PatienceMeter({
  value,
  label = "Patience",
}: {
  value: number;
  label?: string;
}) {
  const band = patienceBand(value);
  const style = BAND_STYLES[band];
  const filled = Math.round((Math.max(0, Math.min(100, value)) / 100) * SEGMENTS);
  return (
    <div className="flex w-44 flex-col gap-1.5" aria-label={`Prospect ${label.toLowerCase()}`}>
      <div className="flex items-center justify-between label-micro text-muted-foreground">
        <span>{label}</span>
        <span className={cn("font-medium", style.text)}>{style.label}</span>
      </div>
      <div className="grid h-7 grid-cols-12 gap-0.5" aria-hidden>
        {Array.from({ length: SEGMENTS }, (_, i) => (
          <span
            key={i}
            className={cn(
              "rounded-[2px] transition-colors duration-500",
              i < filled ? style.fill : "bg-slate/70",
            )}
          />
        ))}
      </div>
    </div>
  );
}
