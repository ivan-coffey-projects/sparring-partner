import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import { reviews } from "@/db/schema";
import { retryReviewAction } from "@/app/review/actions";
import { runReviewGrading } from "@/review/queue";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import { GradingPoller } from "@/components/debrief/grading-poller";
import {
  CoachingCard,
  CriterionCard,
  DroppedPointCard,
  severityRank,
} from "@/components/report/report-cards";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { channelLabel } from "@/lib/labels";
import { isGradingStale } from "@/lib/freshness";

export const metadata = { title: "Review" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const review = db.select().from(reviews).where(eq(reviews.id, id)).get();
  if (!review) notFound();
  if (user.role !== "trainer" && review.userId !== user.id) notFound();

  // Kick an unstarted grading run (e.g. after a server restart).
  if (review.status === "pending") {
    void runReviewGrading(id);
  }
  const stale = isGradingStale({
    status: review.status,
    gradedAt: review.gradedAt,
    createdAt: review.createdAt,
    gradingStartedAt: review.gradingStartedAt,
  });

  const homeHref = user.role === "trainer" ? "/coach" : "/";

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref={homeHref} />
      <AppFrame className="mx-auto max-w-3xl space-y-10">
        <section className="rounded-[24px] bg-background p-6 text-center text-foreground ring-1 ring-foreground/20">
          <p className="label-micro text-foreground/55">
            {channelLabel(review.channel)} ·{" "}
            {review.stage === "cold" ? "cold outreach" : "active deal"}
          </p>
          <h1 className="mt-3 text-3xl font-normal tracking-display">
            {review.title}
          </h1>
          {review.status === "ready" && review.overallScore !== null ? (
            <p className="mt-2 font-mono text-lg">
              {review.overallScore.toFixed(1)}
              <span className="text-muted-foreground">/5 overall</span>
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="text-lg font-semibold tracking-tight">Scorecard</h2>
          <div className="mt-4">
            {review.status === "ready" && review.criteriaScores ? (
              <div className="space-y-3">
                {review.criteriaScores.map((criterion) => (
                  <CriterionCard
                    key={criterion.criterionId}
                    criterion={criterion}
                  />
                ))}
              </div>
            ) : review.status === "failed" || stale ? (
              <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-5">
                <p className="text-sm font-medium">
                  Grading didn&apos;t finish.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {review.error ?? "Grading appears stuck."}
                </p>
                <form action={retryReviewAction.bind(null, id)} className="mt-3">
                  <Button type="submit" size="sm" variant="outline">
                    Retry grading
                  </Button>
                </form>
              </div>
            ) : (
              <GradingPoller />
            )}
          </div>
        </section>

        {review.status === "ready" && review.coachingPoints ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">Coaching</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Every point cites the playbook and quotes your artifact verbatim.
              Anything the grader couldn&apos;t trace was discarded, not
              invented.
            </p>
            <div className="mt-4 space-y-3">
              {review.coachingPoints.length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  The grader made no citable coaching points on this artifact.
                </p>
              ) : (
                [...review.coachingPoints]
                  .sort(
                    (a, b) => severityRank(a.severity) - severityRank(b.severity),
                  )
                  .map((point, i) => <CoachingCard key={i} point={point} />)
              )}
            </div>
          </section>
        ) : null}

        {user.role === "trainer" && review.status === "ready" ? (
          <section>
            <h2 className="text-lg font-semibold tracking-tight">
              Grader audit
              <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                trainer-only · model: {review.graderModel}
              </span>
            </h2>
            <div className="mt-4 space-y-2">
              {(review.droppedPoints ?? []).length === 0 ? (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                  Nothing was dropped — every point traced cleanly.
                </p>
              ) : (
                (review.droppedPoints ?? []).map((point, i) => (
                  <DroppedPointCard key={i} point={point} />
                ))
              )}
            </div>
          </section>
        ) : null}

        <section>
          <h2 className="text-lg font-semibold tracking-tight">The artifact</h2>
          <div className="mt-4 space-y-4">
            {review.turns.map((turn) =>
              turn.speaker === "system" ? (
                <p
                  key={turn.idx}
                  id={`turn-${turn.idx}`}
                  className="scroll-mt-24 text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
                >
                  {turn.text}
                </p>
              ) : (
                <div
                  key={turn.idx}
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
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {turn.speaker === "rep" ? "You" : "Them"}
                    </Badge>
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
            <Link href="/review">Back to reviews</Link>
          </Button>
        </div>
      </AppFrame>
    </div>
  );
}
