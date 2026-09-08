import type {
  CoachingPointRecord,
  CriterionScoreRecord,
  DroppedPointRecord,
} from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Shared rendering for citation-gated reports (debriefs and reviews). */

export function severityRank(severity: CoachingPointRecord["severity"]): number {
  switch (severity) {
    case "critical":
      return 0;
    case "major":
      return 1;
    case "minor":
      return 2;
    default: {
      const exhaustive: never = severity;
      throw new Error(`Unhandled severity: ${String(exhaustive)}`);
    }
  }
}

export function dropReasonLabel(reason: DroppedPointRecord["reason"]): string {
  switch (reason) {
    case "unknown_entry":
      return "cites a methodology entry that doesn't exist";
    case "bad_turn_ref":
      return "cites a turn that doesn't exist";
    case "quote_not_found":
      return "quote not found in the cited turn";
    default: {
      const exhaustive: never = reason;
      throw new Error(`Unhandled reason: ${String(exhaustive)}`);
    }
  }
}

export function CriterionCard({
  criterion,
}: {
  criterion: CriterionScoreRecord;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{criterion.label}</p>
        <p className="font-mono text-sm">
          {criterion.score.toFixed(1)}
          <span className="text-muted-foreground">/5</span>
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full",
            criterion.score >= 3.5
              ? "bg-emerald-500"
              : criterion.score >= 2
                ? "bg-amber-500"
                : "bg-red-500",
          )}
          style={{ width: `${(criterion.score / 5) * 100}%` }}
        />
      </div>
      {criterion.rationale && criterion.citation ? (
        <div className="mt-3 text-sm">
          <p className="text-muted-foreground">{criterion.rationale}</p>
          <p className="mt-1.5">
            <Badge variant="secondary" className="mr-2 font-mono text-[10px]">
              {criterion.citation.methodologyEntryNumber}
            </Badge>
            <a
              href={`#turn-${criterion.citation.turnIdx}`}
              className="text-xs italic text-primary underline-offset-2 hover:underline"
            >
              “{criterion.citation.transcriptQuote}”
            </a>
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          No citable coaching for this criterion — the score stands on the
          engine&apos;s record alone.
        </p>
      )}
    </div>
  );
}

export function CoachingCard({ point }: { point: CoachingPointRecord }) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        point.severity === "critical"
          ? "border-red-500/40"
          : point.severity === "major"
            ? "border-amber-500/40"
            : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] uppercase",
            point.severity === "critical"
              ? "border-red-500/50 text-red-400"
              : point.severity === "major"
                ? "border-amber-500/50 text-amber-400"
                : "text-muted-foreground",
          )}
        >
          {point.severity}
        </Badge>
        <p className="text-sm font-medium">
          <span className="mr-1.5 font-mono text-xs text-muted-foreground">
            {point.methodologyEntryNumber}
          </span>
          {point.methodologyEntryTitle}
        </p>
      </div>
      <a
        href={`#turn-${point.turnIdx}`}
        className="mt-2 block rounded-lg bg-muted/40 px-3 py-2 text-sm italic text-muted-foreground underline-offset-2 hover:underline"
      >
        “{point.transcriptQuote}” — turn {point.turnIdx}
      </a>
      <p className="mt-2 text-sm leading-relaxed">{point.comment}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        {point.methodologyEntryText}
      </p>
    </div>
  );
}

export function DroppedPointCard({ point }: { point: DroppedPointRecord }) {
  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-amber-500">
        Dropped · {dropReasonLabel(point.reason)}
      </p>
      <p className="mt-1 text-muted-foreground">
        cited {point.methodologyEntryNumber} @ turn {point.turnIdx}: “
        {point.transcriptQuote}”
      </p>
      <p className="mt-1">{point.comment}</p>
    </div>
  );
}
