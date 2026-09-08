import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { methodologies, methodologyEntries } from "@/db/schema";
import { MethodologyForm } from "@/components/coach/methodology-form";

export const metadata = { title: "Edit methodology" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function EditMethodologyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const methodology = db
    .select()
    .from(methodologies)
    .where(eq(methodologies.id, id))
    .get();
  if (!methodology) notFound();
  const entries = db
    .select()
    .from(methodologyEntries)
    .where(eq(methodologyEntries.methodologyId, id))
    .orderBy(asc(methodologyEntries.sortOrder))
    .all();

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {methodology.name}
      </h1>
      <MethodologyForm
        initial={{
          id: methodology.id,
          name: methodology.name,
          description: methodology.description,
          entries: entries.map((e) => ({
            id: e.id,
            number: e.number,
            title: e.title,
            text: e.text,
          })),
        }}
      />
    </div>
  );
}
