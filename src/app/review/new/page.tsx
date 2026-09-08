import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import { methodologies, scorecards } from "@/db/schema";
import { AppFrame } from "@/components/app-frame";
import { AppHeader } from "@/components/app-header";
import {
  ReviewForm,
  type ScorecardOption,
} from "@/components/review/review-form";

export const metadata = { title: "New review" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function NewReviewPage() {
  const user = await requireUser();
  const homeHref = user.role === "trainer" ? "/coach" : "/";

  const options: ScorecardOption[] = db
    .select({
      id: scorecards.id,
      name: scorecards.name,
      methodologyName: methodologies.name,
    })
    .from(scorecards)
    .innerJoin(methodologies, eq(scorecards.methodologyId, methodologies.id))
    .orderBy(asc(scorecards.name))
    .all();

  return (
    <div className="min-h-dvh bg-background">
      <AppHeader user={user} homeHref={homeHref} />
      <AppFrame className="mx-auto max-w-3xl space-y-6">
        <div>
          <p className="label-micro text-muted-foreground">The tape room</p>
          <h1 className="mt-2 text-3xl font-normal tracking-display">
            Score a real conversation
          </h1>
        </div>
        <ReviewForm scorecards={options} />
      </AppFrame>
    </div>
  );
}
