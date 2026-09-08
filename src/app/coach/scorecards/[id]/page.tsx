import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { scorecardCriteria, scorecards } from "@/db/schema";
import { ScorecardForm } from "@/components/coach/scorecard-form";
import { loadMethodologyOptions } from "@/lib/coach-queries";

export const metadata = { title: "Edit scorecard" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function EditScorecardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const scorecard = db
    .select()
    .from(scorecards)
    .where(eq(scorecards.id, id))
    .get();
  if (!scorecard) notFound();
  const criteria = db
    .select()
    .from(scorecardCriteria)
    .where(eq(scorecardCriteria.scorecardId, id))
    .orderBy(asc(scorecardCriteria.sortOrder))
    .all();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {scorecard.name}
      </h1>
      <ScorecardForm
        methodologies={loadMethodologyOptions()}
        initial={{
          id: scorecard.id,
          name: scorecard.name,
          methodologyId: scorecard.methodologyId,
          criteria: criteria.map((c) => ({
            id: c.id,
            label: c.label,
            description: c.description,
            weight: c.weight,
            methodologyEntryIds: c.methodologyEntryIds,
          })),
        }}
      />
    </div>
  );
}
