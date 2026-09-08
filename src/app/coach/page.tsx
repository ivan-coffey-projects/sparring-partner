import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, drills, prospects, reports, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { InviteButtons } from "@/components/coach/invite-buttons";
import { cn } from "@/lib/utils";
import { outcomeLabel } from "@/lib/labels";

export const metadata = { title: "Coach dashboard" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

interface RepAggregate {
  repId: string;
  repName: string;
  callCount: number;
  gradedCount: number;
  scoreSum: number;
  criterionScores: Map<string, { sum: number; count: number; low: number }>;
}

export default async function CoachDashboardPage() {
  const reps = db.select().from(users).where(eq(users.role, "rep")).all();

  const gradedRows = db
    .select({
      repId: calls.repId,
      outcome: calls.outcome,
      startedAt: calls.startedAt,
      status: reports.status,
      overallScore: reports.overallScore,
      criteriaScores: reports.criteriaScores,
    })
    .from(calls)
    .leftJoin(reports, eq(reports.callId, calls.id))
    .where(eq(calls.status, "ended"))
    .all();

  const aggregates = new Map<string, RepAggregate>(
    reps.map((rep) => [
      rep.id,
      {
        repId: rep.id,
        repName: rep.name,
        callCount: 0,
        gradedCount: 0,
        scoreSum: 0,
        criterionScores: new Map(),
      },
    ]),
  );

  const criterionLabels = new Set<string>();
  for (const row of gradedRows) {
    const aggregate = aggregates.get(row.repId);
    if (!aggregate) continue;
    aggregate.callCount += 1;
    if (row.status === "ready" && row.overallScore !== null) {
      aggregate.gradedCount += 1;
      aggregate.scoreSum += row.overallScore;
      for (const criterion of row.criteriaScores ?? []) {
        criterionLabels.add(criterion.label);
        const bucket = aggregate.criterionScores.get(criterion.label) ?? {
          sum: 0,
          count: 0,
          low: 0,
        };
        bucket.sum += criterion.score;
        bucket.count += 1;
        if (criterion.score < 2.5) bucket.low += 1;
        aggregate.criterionScores.set(criterion.label, bucket);
      }
    }
  }
  const columns = [...criterionLabels].sort();

  const recurringFailures: Array<{ repName: string; label: string; avg: number; n: number }> =
    [];
  for (const aggregate of aggregates.values()) {
    for (const [label, bucket] of aggregate.criterionScores) {
      if (bucket.count >= 2 && bucket.low >= 2) {
        recurringFailures.push({
          repName: aggregate.repName,
          label,
          avg: bucket.sum / bucket.count,
          n: bucket.count,
        });
      }
    }
  }
  recurringFailures.sort((a, b) => a.avg - b.avg);

  const recentCalls = db
    .select({
      id: calls.id,
      startedAt: calls.startedAt,
      outcome: calls.outcome,
      status: calls.status,
      repName: users.name,
      drillTitle: drills.title,
      prospectName: prospects.name,
      reportStatus: reports.status,
      overallScore: reports.overallScore,
    })
    .from(calls)
    .innerJoin(users, eq(calls.repId, users.id))
    .innerJoin(drills, eq(calls.drillId, drills.id))
    .innerJoin(prospects, eq(drills.prospectId, prospects.id))
    .leftJoin(reports, eq(reports.callId, calls.id))
    .orderBy(desc(calls.startedAt))
    .limit(12)
    .all();

  const totalCalls = gradedRows.length;
  const gradedCalls = gradedRows.filter((r) => r.status === "ready").length;
  const avgScore =
    gradedCalls > 0
      ? gradedRows
          .filter((r) => r.overallScore !== null)
          .reduce((acc, r) => acc + (r.overallScore ?? 0), 0) / gradedCalls
      : null;

  const emptyGym = reps.length === 0 && totalCalls === 0;

  return (
    <div className="space-y-10">
      {emptyGym ? (
        <section className="rounded-[22px] border border-foreground/15 bg-background p-6 text-foreground">
          <p className="label-micro text-foreground/55">Get started</p>
          <h2 className="mt-2 text-2xl font-normal tracking-display">
            Stand up the gym
          </h2>
          <p className="mt-2 max-w-xl text-sm text-foreground/70">
            Build the playbook first, then invite a representative. Nothing
            here reaches a live inbox or a real prospect.
          </p>
          <ol className="mt-5 grid gap-2 text-sm sm:grid-cols-2">
            <StartStep href="/coach/methodology" n="1" label="Write a methodology" />
            <StartStep href="/coach/prospects" n="2" label="Author a prospect" />
            <StartStep href="/coach/scorecards" n="3" label="Attach a scorecard" />
            <StartStep href="/coach/drills" n="4" label="Assign a drill" />
          </ol>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Reps" value={String(reps.length)} />
        <StatCard label="Calls drilled" value={String(totalCalls)} />
        <StatCard label="Graded" value={String(gradedCalls)} />
        <StatCard
          label="Avg score"
          value={avgScore !== null ? `${avgScore.toFixed(1)}/5` : "—"}
        />
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Where they keep failing
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Criteria scored below 2.5 in at least two graded calls.
        </p>
        <div className="mt-4">
          {recurringFailures.length === 0 ? (
            <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
              No recurring failures yet — either they&apos;re good, or they
              haven&apos;t drilled enough.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {recurringFailures.map((failure, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl border border-red-500/25 bg-red-500/5 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{failure.repName}</p>
                    <p className="text-xs text-muted-foreground">
                      {failure.label} · {failure.n} calls
                    </p>
                  </div>
                  <p className="font-mono text-sm text-red-400">
                    {failure.avg.toFixed(1)}/5
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">
          Reps × criteria
        </h2>
        <div className="mt-4 overflow-x-auto rounded-[20px] bg-background text-foreground">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-foreground/10">
                <th className="px-4 py-2.5 text-left font-medium">Rep</th>
                <th className="px-3 py-2.5 text-right font-medium">Drilled</th>
                <th className="px-3 py-2.5 text-right font-medium">Avg</th>
                {columns.map((label) => (
                  <th
                    key={label}
                    className="px-3 py-2.5 text-right font-medium text-muted-foreground"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...aggregates.values()].map((aggregate) => (
                <tr key={aggregate.repId} className="border-b last:border-0">
                  <td className="px-4 py-2.5">
                    <Link
                      href={`/coach/reps/${aggregate.repId}`}
                      className="font-medium text-primary underline-offset-2 hover:underline"
                    >
                      {aggregate.repName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {aggregate.callCount}
                  </td>
                  <td className="px-3 py-2.5 text-right font-mono">
                    {aggregate.gradedCount > 0
                      ? (aggregate.scoreSum / aggregate.gradedCount).toFixed(1)
                      : "—"}
                  </td>
                  {columns.map((label) => {
                    const bucket = aggregate.criterionScores.get(label);
                    const avg = bucket ? bucket.sum / bucket.count : null;
                    return (
                      <td
                        key={label}
                        className={cn(
                          "px-3 py-2.5 text-right font-mono",
                          avg === null
                            ? "text-muted-foreground/50"
                            : avg >= 3.5
                              ? "text-emerald-400"
                              : avg >= 2.5
                                ? "text-amber-400"
                                : "text-red-400",
                        )}
                      >
                        {avg === null ? "·" : avg.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Recent calls</h2>
        <div className="mt-4 divide-y rounded-xl border bg-card">
          {recentCalls.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            recentCalls.map((call) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}/debrief`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {call.repName}
                    <span className="text-muted-foreground">
                      {" "}
                      vs {call.prospectName} · {call.drillTitle}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(call.startedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge
                    variant={
                      call.outcome === "meeting_booked"
                        ? "default"
                        : call.outcome === "hung_up" ||
                              call.outcome === "ghosted" ||
                              call.outcome === "opted_out"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {call.status === "live" ? "Live" : outcomeLabel(call.outcome)}
                  </Badge>
                  {call.reportStatus === "ready" && call.overallScore !== null ? (
                    <Badge variant="outline" className="font-mono">
                      {call.overallScore.toFixed(1)}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold tracking-tight">Invite people</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          One-time links, valid for 14 days. No email required.
        </p>
        <div className="mt-4">
          <InviteButtons />
        </div>
      </section>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-background p-5 text-foreground">
      <p className="label-micro text-foreground/55">{label}</p>
      <p className="mt-3 font-mono text-[28px] tracking-tight">{value}</p>
    </div>
  );
}

function StartStep({
  href,
  n,
  label,
}: {
  href: string;
  n: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-xl border border-foreground/12 px-4 py-3 transition-colors hover:border-foreground/30 hover:bg-foreground/5"
    >
      <span className="font-mono text-[11px] text-foreground/45">{n}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}
