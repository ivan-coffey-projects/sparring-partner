import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { methodologies, methodologyEntries } from "@/db/schema";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Methodology" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function MethodologyListPage() {
  const rows = db
    .select({
      id: methodologies.id,
      name: methodologies.name,
      description: methodologies.description,
      entryCount: sql<number>`(select count(*) from ${methodologyEntries} where ${methodologyEntries.methodologyId} = ${methodologies.id})`,
    })
    .from(methodologies)
    .orderBy(desc(methodologies.createdAt))
    .all();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Methodology
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your numbered entries are the only thing the grader is allowed to
            coach from.
          </p>
        </div>
        <Button asChild>
          <Link href="/coach/methodology/new">New methodology</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">
            No methodology yet. Write yours down — it becomes the rubric.
          </p>
        ) : (
          rows.map((methodology) => (
            <Link
              key={methodology.id}
              href={`/coach/methodology/${methodology.id}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{methodology.name}</p>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                {methodology.description}
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {methodology.entryCount} numbered entries
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
