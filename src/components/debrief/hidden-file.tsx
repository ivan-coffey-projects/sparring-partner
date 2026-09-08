import { Lock, LockOpen } from "lucide-react";
import { cn } from "@/lib/utils";

export interface HiddenFileFact {
  id: string;
  label: string;
  truth: string;
  politeLie: string;
  unlocked: boolean;
}

/**
 * The debrief's signature moment: the hidden file, opened. What the rep
 * earned, and the polite fiction they were fed for everything they didn't.
 */
export function HiddenFile({ facts }: { facts: HiddenFileFact[] }) {
  const uncovered = facts.filter((f) => f.unlocked).length;
  return (
    <section>
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          The hidden file
        </h2>
        <p className="text-sm text-muted-foreground">
          You uncovered{" "}
          <span className="font-mono font-medium text-foreground">
            {uncovered}/{facts.length}
          </span>
        </p>
      </div>
      <div className="mt-4 grid gap-3">
        {facts.map((fact) => (
          <div
            key={fact.id}
            className={cn(
              "rounded-[20px] border p-4",
              fact.unlocked
                ? "border-glow/40 bg-glow/10"
                : "border-border bg-card",
            )}
          >
            <div className="flex items-center gap-2">
              {fact.unlocked ? (
                <LockOpen className="size-3.5 text-emerald-500" />
              ) : (
                <Lock className="size-3.5 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">{fact.label}</p>
              <span
                className={cn(
                  "ml-auto text-[11px] uppercase tracking-wider",
                  fact.unlocked ? "text-emerald-500" : "text-muted-foreground",
                )}
              >
                {fact.unlocked ? "You earned this" : "Never uncovered"}
              </span>
            </div>
            {fact.unlocked ? (
              <p className="mt-2 text-sm leading-relaxed">{fact.truth}</p>
            ) : (
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className="rounded-lg bg-muted/50 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    What you were told
                  </p>
                  <p className="mt-1 text-sm italic leading-relaxed text-muted-foreground">
                    “{fact.politeLie}”
                  </p>
                </div>
                <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-red-400">
                    What was actually true
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{fact.truth}</p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
