import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { hiddenFacts, prospects } from "@/db/schema";
import { ProspectForm } from "@/components/coach/prospect-form";
import type { ProspectPayload } from "@/app/coach/actions";

export const metadata = { title: "Edit prospect" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function EditProspectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prospect = db
    .select()
    .from(prospects)
    .where(eq(prospects.id, id))
    .get();
  if (!prospect) notFound();
  const facts = db
    .select()
    .from(hiddenFacts)
    .where(eq(hiddenFacts.prospectId, id))
    .orderBy(asc(hiddenFacts.sortOrder))
    .all();

  const initial: ProspectPayload = {
    id: prospect.id,
    name: prospect.name,
    jobTitle: prospect.jobTitle,
    company: prospect.company,
    persona: prospect.persona,
    dealContext: prospect.dealContext,
    openingLine: prospect.openingLine,
    patienceConfig: prospect.patienceConfig,
    concessionCaps: prospect.concessionCaps,
    facts: facts.map((f) => ({
      id: f.id,
      label: f.label,
      topic: f.topic,
      truth: f.truth,
      politeLie: f.politeLie,
      unlockRule: f.unlockRule,
    })),
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">
        {prospect.name}
      </h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        {prospect.jobTitle}, {prospect.company}
      </p>
      <ProspectForm initial={initial} />
    </div>
  );
}
