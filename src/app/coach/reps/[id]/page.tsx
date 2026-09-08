import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, drills, prospects, reports, users } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { outcomeLabel } from "@/lib/labels";

export const metadata = { title: "Rep detail" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function RepDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const rep = db.select().from(users).where(eq(users.id, id)).get();
  if (!rep || rep.role !== "rep") notFound();

  const repCalls = db
    .select({
      id: calls.id,
      startedAt: calls.startedAt,
      status: calls.status,
      outcome: calls.outcome,
      drillTitle: drills.title,
      prospectName: prospects.name,
      reportStatus: reports.status,
      overallScore: reports.overallScore,
      criteriaScores: reports.criteriaScores,
    })
    .from(calls)
    .innerJoin(drills, eq(calls.drillId, drills.id))
    .innerJoin(prospects, eq(drills.prospectId, prospects.id))
    .leftJoin(reports, eq(reports.callId, calls.id))
    .where(eq(calls.repId, id))
    .orderBy(desc(calls.startedAt))
    .all();

  const graded = repCalls.filter(
    (c) => c.reportStatus === "ready" && c.overallScore !== null,
  );
  const avg =
    graded.length > 0
      ? graded.reduce((acc, c) => acc + (c.overallScore ?? 0), 0) / graded.length
      : null;

  const criterionBuckets = new Map<string, { sum: number; count: number }>();
  for (const call of graded) {
    for (const criterion of call.criteriaScores ?? []) {
      const bucket = criterionBuckets.get(criterion.label) ?? {
        sum: 0,
        count: 0,
      };
      bucket.sum += criterion.score;
      bucket.count += 1;
      criterionBuckets.set(criterion.label, bucket);
    }
  }
  const weakest = [...criterionBuckets.entries()]
    .map(([label, bucket]) => ({ label, avg: bucket.sum / bucket.count }))
    .sort((a, b) => a.avg - b.avg)
    .slice(0, 3);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{rep.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {rep.email} · {repCalls.length} calls ·{" "}
          {avg !== null ? `${avg.toFixed(1)}/5 average` : "not graded yet"}
        </p>
      </div>

      {weakest.length > 0 ? (
        <section>
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
            Weakest criteria
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {weakest.map((w) => (
              <Badge
                key={w.label}
                variant="outline"
                className="border-amber-500/40 text-amber-400"
              >
                {w.label} · {w.avg.toFixed(1)}/5
              </Badge>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Call history
        </h2>
        <div className="mt-3 divide-y rounded-xl border bg-card">
          {repCalls.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No calls yet.</p>
          ) : (
            repCalls.map((call) => (
              <Link
                key={call.id}
                href={`/calls/${call.id}/debrief`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-accent/50"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {call.prospectName}
                    <span className="text-muted-foreground">
                      {" "}
                      · {call.drillTitle}
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
    </div>
  );
}
