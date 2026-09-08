import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import {
  calls,
  callTurns,
  drills,
  hiddenFacts,
  prospects,
  reports,
  users,
} from "@/db/schema";
import { runGrading } from "@/grading/queue";
import { retryGradingAction, startCallAction } from "@/app/calls/actions";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import { GradingPoller } from "@/components/debrief/grading-poller";
import { HiddenFile } from "@/components/debrief/hidden-file";
import {
  PatienceTimeline,
  type TimelinePoint,
} from "@/components/debrief/patience-timeline";
import {
  CoachingCard,
  CriterionCard,
  DroppedPointCard,
  severityRank,
} from "@/components/report/report-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { channelLabel, outcomeLabel } from "@/lib/labels";
import { durationLabel } from "@/lib/duration";
import { isGradingStale } from "@/lib/freshness";

export const metadata = { title: "Debrief" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function DebriefPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const call = db.select().from(calls).where(eq(calls.id, id)).get();
  if (!call) notFound();
  if (user.role !== "trainer" && call.repId !== user.id) notFound();
  if (call.status === "live") {
    if (user.role === "trainer") notFound();
    redirect(`/calls/${id}`);
  }

  const drill = db
    .select()
    .from(drills)
    .where(eq(drills.id, call.drillId))
    .get();
  if (!drill) notFound();
  const prospect = db
    .select()
    .from(prospects)
    .where(eq(prospects.id, drill.prospectId))
    .get();
  if (!prospect) notFound();
  const rep = db.select().from(users).where(eq(users.id, call.repId)).get();
  const facts = db
    .select()
    .from(hiddenFacts)
    .where(eq(hiddenFacts.prospectId, prospect.id))
    .orderBy(asc(hiddenFacts.sortOrder))
    .all();
  const turns = db
    .select()
    .from(callTurns)
    .where(eq(callTurns.callId, id))
    .orderBy(asc(callTurns.idx))
    .all();
  const report = db
    .select()
    .from(reports)
    .where(eq(reports.callId, id))
    .get();

  // Kick an unstarted grading run (e.g. after a server restart).
  if (report?.status === "pending") {
    void runGrading(id);
  }

  const homeHref = user.role === "trainer" ? "/coach" : "/";
  const gradingStale = report !== undefined && isGradingStale(report);

  const timelinePoints: TimelinePoint[] = turns
    .filter((t) => t.speaker === "rep" && t.analysis)
    .map((t) => ({
      turnIdx: t.idx,
      patience: t.analysis!.patience,
      deltas: t.analysis!.patienceDeltas,
    }));

  const unlockedSet = new Set(call.unlockedFactIds);

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref={homeHref} />
      <AppFrame className="mx-auto max-w-3xl space-y-10">
        {/* ── Outcome ─────────────────────────────────────────────── */}
        <section
          className={cn(
            "rounded-[24px] bg-background p-6 text-center text-foreground",
            call.outcome === "meeting_booked"
              ? "ring-2 ring-glow"
              : call.outcome === "hung_up" ||
                  call.outcome === "ghosted" ||
                  call.outcome === "opted_out"
                ? "ring-2 ring-red-500/50"
                : "ring-1 ring-foreground/20",
          )}
        >
          <p className="label-micro text-foreground/55">
            {drill.title} · {channelLabel(drill.channel)} · {prospect.name}
            {user.role === "trainer" && rep ? ` · rep: ${rep.name}` : ""}
          </p>
          <h1 className="mt-3 text-4xl font-normal tracking-display">
            {outcomeLabel(call.outcome)}
          </h1>
          {report?.status === "ready" && report.overallScore !== null ? (
            <p className="mt-2 font-mono text-lg">
              {report.overallScore.toFixed(1)}
              <span className="text-muted-foreground">/5 overall</span>
            </p>
          ) : null}
          {user.role === "rep" ? (
            <form
              action={startCallAction.bind(null, drill.id)}
              className="mt-4 inline-block"
            >
              <Button type="submit" variant="outline">
                Drill again
              </Button>
            </form>
          ) : null}
        </section>

        {/* ── Hidden file ─────────────────────────────────────────── */}
        <HiddenFile
          facts={facts.map((f) => ({
            id: f.id,
            label: f.label,
            truth: f.truth,
            politeLie: f.politeLie,
            unlocked: unlockedSet.has(f.id),
          }))}
        />

        {/* ── Patience/engagement timeline ────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">
            {drill.channel === "call"
              ? "Patience over the call"
              : "Interest over the thread"}
          </h2>
          <div className="mt-4 rounded-xl border bg-card p-4">
            <PatienceTimeline
              initial={prospect.patienceConfig.initial}
              points={timelinePoints}
            />
          </div>
        </section>

        {/* ── Scorecard ───────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Scorecard</h2>
          <div className="mt-4">
            {report?.status === "ready" && report.criteriaScores ? (
              <div className="space-y-3">
                {report.criteriaScores.map((criterion) => (
                  <CriterionCard key={criterion.criterionId} criterion={criterion} />
                ))}
              </div>
            ) : report?.status === "failed" && !gradingStale ? (
              <FailedGrading error={report.error} callId={id} />
            ) : gradingStale ? (
              <FailedGrading error="Grading appears stuck." callId={id} />
            ) : (
              <GradingPoller />
            )}
          </div>
        </section>

        {/* ── Coaching ────────────────────────────────────────────── */}
        {report?.status === "ready" && report.coachingPoints ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Coaching</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every point below cites your trainer&apos;s methodology and the
              exact line it applies to. Anything the grader couldn&apos;t trace
              was discarded, not invented.
            </p>
            <div className="mt-4 space-y-3">
              {report.coachingPoints.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  The grader made no citable coaching points on this call.
                </p>
              ) : (
                [...report.coachingPoints]
                  .sort(
                    (a, b) =>
                      severityRank(a.severity) - severityRank(b.severity),
                  )
                  .map((point, i) => <CoachingCard key={i} point={point} />)
              )}
            </div>
          </section>
        ) : null}

        {/* ── Trainer audit ───────────────────────────────────────── */}
        {user.role === "trainer" && report?.status === "ready" ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Grader audit
              <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                trainer-only · model: {report.graderModel}
              </span>
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Points the citation gate dropped. Reps never see these.
            </p>
            <div className="mt-4 space-y-2">
              {(report.droppedPoints ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Nothing was dropped — every point traced cleanly.
                </p>
              ) : (
                (report.droppedPoints ?? []).map((point, i) => (
                  <DroppedPointCard key={i} point={point} />
                ))
              )}
            </div>
          </section>
        ) : null}

        {/* ── Transcript ──────────────────────────────────────────── */}
        <section>
          <h2 className="text-lg font-semibold tracking-tight">Transcript</h2>
          <div className="mt-4 space-y-4">
            {turns.map((turn) =>
              turn.speaker === "system" ? (
                <p
                  key={turn.id}
                  id={`turn-${turn.idx}`}
                  className="scroll-mt-24 text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  {turn.text}
                </p>
              ) : (
              <div
                key={turn.id}
                id={`turn-${turn.idx}`}
                className={cn(
                  "scroll-mt-24 rounded-xl border p-4",
                  turn.speaker === "rep" ? "bg-card" : "bg-muted/30",
                )}
              >
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {turn.idx}
                  </span>
                  <span className="text-xs font-medium">
                    {turn.speaker === "rep"
                      ? user.role === "trainer" && rep
                        ? rep.name
                        : "You"
                      : prospect.name}
                  </span>
                  {turn.meta?.delayMinutes ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      · {durationLabel(turn.meta.delayMinutes)} later
                    </span>
                  ) : null}
                  {turn.meta?.subject ? (
                    <span className="truncate text-[11px] text-muted-foreground">
                      · Subject: {turn.meta.subject}
                    </span>
                  ) : null}
                  {turn.analysis ? (
                    <span className="ml-auto flex flex-wrap justify-end gap-1">
                      {turn.analysis.patienceDeltas.map((delta, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            delta.amount < 0
                              ? "border-red-500/40 text-red-400"
                              : "border-emerald-500/40 text-emerald-400",
                          )}
                        >
                          {delta.amount > 0 ? "+" : ""}
                          {delta.amount} {delta.reason.replaceAll("_", " ")}
                        </Badge>
                      ))}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                  {turn.text}
                </p>
              </div>
              ),
            )}
          </div>
        </section>

        <div className="pb-6 text-center">
          <Button asChild variant="ghost">
            <Link href={homeHref}>Back to {user.role === "trainer" ? "dashboard" : "your drills"}</Link>
          </Button>
        </div>
      </AppFrame>
    </div>
  );
}

function FailedGrading({
  error,
  callId,
}: {
  error: string | null;
  callId: string;
}) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
      <p className="text-sm font-medium">Grading didn&apos;t finish.</p>
      <p className="mt-1 text-xs text-muted-foreground">{error}</p>
      <form action={retryGradingAction.bind(null, callId)} className="mt-3">
        <Button type="submit" size="sm" variant="outline">
          Retry grading
        </Button>
      </form>
    </div>
  );
}
