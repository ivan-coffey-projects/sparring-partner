import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { methodologies, scorecardCriteria, scorecards } from "@/db/schema";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Scorecards" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function ScorecardsPage() {
  const rows = db
    .select({
      id: scorecards.id,
      name: scorecards.name,
      methodologyName: methodologies.name,
      criterionCount: sql<number>`(select count(*) from ${scorecardCriteria} where ${scorecardCriteria.scorecardId} = ${scorecards.id})`,
    })
    .from(scorecards)
    .innerJoin(methodologies, eq(scorecards.methodologyId, methodologies.id))
    .orderBy(desc(scorecards.createdAt))
    .all();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Scorecards</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your scorecard becomes the rubric the grader must follow.
          </p>
        </div>
        <Button asChild>
          <Link href="/coach/scorecards/new">New scorecard</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">
            No scorecards yet. Create a methodology first, then attach the
            criteria the grader is required to follow.
          </p>
        ) : (
          rows.map((scorecard) => (
            <Link
              key={scorecard.id}
              href={`/coach/scorecards/${scorecard.id}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{scorecard.name}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {scorecard.methodologyName}
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {scorecard.criterionCount} criteria
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
