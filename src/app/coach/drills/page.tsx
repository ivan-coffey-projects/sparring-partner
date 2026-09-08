import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { calls, drillAssignments, drills, prospects, scorecards } from "@/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { channelLabel } from "@/lib/labels";

export const metadata = { title: "Drills" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function DrillsPage() {
  const rows = db
    .select({
      id: drills.id,
      title: drills.title,
      channel: drills.channel,
      prospectName: prospects.name,
      scorecardName: scorecards.name,
      assignedCount: sql<number>`(select count(*) from ${drillAssignments} where ${drillAssignments.drillId} = ${drills.id})`,
      callCount: sql<number>`(select count(*) from ${calls} where ${calls.drillId} = ${drills.id})`,
    })
    .from(drills)
    .innerJoin(prospects, eq(drills.prospectId, prospects.id))
    .innerJoin(scorecards, eq(drills.scorecardId, scorecards.id))
    .orderBy(desc(drills.createdAt))
    .all();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Drills</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A prospect, a scorecard, and the reps who need the reps.
          </p>
        </div>
        <Button asChild>
          <Link href="/coach/drills/new">New drill</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">
            No drills yet. Pair a prospect with a scorecard, then assign
            representatives. Each drill is one practice bout on one channel.
          </p>
        ) : (
          rows.map((drill) => (
            <Link
              key={drill.id}
              href={`/coach/drills/${drill.id}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{drill.title}</p>
                <Badge variant="secondary" className="shrink-0 text-[10px]">
                  {channelLabel(drill.channel)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                vs {drill.prospectName} · {drill.scorecardName}
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {drill.assignedCount} reps assigned · {drill.callCount} calls
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
