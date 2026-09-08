import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import {
  calls,
  drillAssignments,
  drills,
  prospects,
  reports,
} from "@/db/schema";
import { startCallAction } from "@/app/calls/actions";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { channelLabel, outcomeLabel } from "@/lib/labels";

// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function RepHomePage() {
  const user = await requireUser("rep");

  const assigned = db
    .select({
      drillId: drills.id,
      title: drills.title,
      channel: drills.channel,
      briefing: drills.briefing,
      prospectName: prospects.name,
      prospectTitle: prospects.jobTitle,
      prospectCompany: prospects.company,
    })
    .from(drillAssignments)
    .innerJoin(drills, eq(drillAssignments.drillId, drills.id))
    .innerJoin(prospects, eq(drills.prospectId, prospects.id))
    .where(eq(drillAssignments.repId, user.id))
    .all();

  const recentCalls = db
    .select({
      id: calls.id,
      status: calls.status,
      outcome: calls.outcome,
      startedAt: calls.startedAt,
      drillTitle: drills.title,
      prospectName: prospects.name,
      reportStatus: reports.status,
      overallScore: reports.overallScore,
    })
    .from(calls)
    .innerJoin(drills, eq(calls.drillId, drills.id))
    .innerJoin(prospects, eq(drills.prospectId, prospects.id))
    .leftJoin(reports, eq(reports.callId, calls.id))
    .where(eq(calls.repId, user.id))
    .orderBy(desc(calls.startedAt))
    .limit(10)
    .all();

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref="/" />
      <AppFrame className="space-y-8">
        <section className="rounded-[22px] bg-background p-6 text-foreground md:p-8">
          <p className="label-micro text-foreground/60">Today&apos;s ring</p>
          <h1 className="mt-3 max-w-[12ch] text-4xl font-normal leading-[0.95] tracking-display">
            {user.name.split(" ")[0]}, welcome back
          </h1>
          <p className="mt-4 max-w-md text-sm text-foreground/70">
            Live calls against prospects your trainer built. Earn the truth —
            don&apos;t interrogate for it.
          </p>
        </section>
        <section>
          <p className="label-micro text-muted-foreground">Your drills</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {assigned.length === 0 ? (
              <Card className="sm:col-span-2">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  No drills assigned yet. Your trainer will send one your way.
                </CardContent>
              </Card>
            ) : (
              assigned.map((drill) => (
                <Card key={drill.drillId} className="flex flex-col border-border/80">
                  <CardHeader>
                    <div className="flex items-center justify-between gap-2">
                      <p className="label-micro text-muted-foreground">New challenge</p>
                      <Badge variant="secondary" className="text-[10px]">
                        {channelLabel(drill.channel)}
                      </Badge>
                    </div>
                    <CardTitle className="text-lg tracking-tight">{drill.title}</CardTitle>
                    <CardDescription>
                      {drill.prospectName} · {drill.prospectTitle},{" "}
                      {drill.prospectCompany}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1 text-sm text-muted-foreground">
                    {drill.briefing}
                  </CardContent>
                  <CardFooter>
                    <form
                      action={startCallAction.bind(null, drill.drillId)}
                      className="w-full"
                    >
                      <Button type="submit" className="w-full">
                        {drill.channel === "call" ? "Start call" : "Open thread"}
                      </Button>
                    </form>
                  </CardFooter>
                </Card>
              ))
            )}
          </div>
        </section>

        {recentCalls.length > 0 ? (
          <section>
            <p className="label-micro text-muted-foreground">Recent calls</p>
            <div className="mt-4 divide-y divide-border overflow-hidden rounded-[22px] border bg-background text-foreground">
              {recentCalls.map((call) => (
                <Link
                  key={call.id}
                  href={
                    call.status === "live"
                      ? `/calls/${call.id}`
                      : `/calls/${call.id}/debrief`
                  }
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-foreground/5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      {call.prospectName}
                      <span className="text-foreground/55">
                        {" "}
                        · {call.drillTitle}
                      </span>
                    </p>
                    <p className="font-mono text-[10px] uppercase tracking-wide text-foreground/50">
                      {new Date(call.startedAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {call.status === "live" ? (
                      <Badge variant="outline">Live</Badge>
                    ) : (
                      <>
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
                          {outcomeLabel(call.outcome)}
                        </Badge>
                        {call.reportStatus === "ready" &&
                        call.overallScore !== null ? (
                          <Badge variant="outline">
                            {call.overallScore.toFixed(1)}/5
                          </Badge>
                        ) : null}
                      </>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </AppFrame>
    </div>
  );
}
