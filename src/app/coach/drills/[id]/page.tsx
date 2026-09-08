import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { drillAssignments, drills } from "@/db/schema";
import { DrillForm } from "@/components/coach/drill-form";
import { loadDrillFormOptions } from "@/lib/drill-queries";

export const metadata = { title: "Edit drill" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function EditDrillPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const drill = db.select().from(drills).where(eq(drills.id, id)).get();
  if (!drill) notFound();
  const assignments = db
    .select()
    .from(drillAssignments)
    .where(eq(drillAssignments.drillId, id))
    .all();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {drill.title}
      </h1>
      <DrillForm
        options={loadDrillFormOptions()}
        initial={{
          id: drill.id,
          title: drill.title,
          channel: drill.channel,
          briefing: drill.briefing,
          prospectId: drill.prospectId,
          scorecardId: drill.scorecardId,
          repIds: assignments.map((a) => a.repId),
        }}
      />
    </div>
  );
}
