import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { hiddenFacts, prospects } from "@/db/schema";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Prospects" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function ProspectsPage() {
  const rows = db
    .select({
      id: prospects.id,
      name: prospects.name,
      jobTitle: prospects.jobTitle,
      company: prospects.company,
      dealContext: prospects.dealContext,
      factCount: sql<number>`(select count(*) from ${hiddenFacts} where ${hiddenFacts.prospectId} = ${prospects.id})`,
    })
    .from(prospects)
    .orderBy(desc(prospects.createdAt))
    .all();

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Prospects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Author them from deals your clients are actually losing.
          </p>
        </div>
        <Button asChild>
          <Link href="/coach/prospects/new">New prospect</Link>
        </Button>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground sm:col-span-2">
            No prospects yet. Build your first one from a deal that got away.
          </p>
        ) : (
          rows.map((prospect) => (
            <Link
              key={prospect.id}
              href={`/coach/prospects/${prospect.id}`}
              className="rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <p className="font-medium">{prospect.name}</p>
              <p className="text-sm text-muted-foreground">
                {prospect.jobTitle}, {prospect.company}
              </p>
              <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">
                {prospect.dealContext || "No deal context recorded."}
              </p>
              <p className="mt-3 font-mono text-xs text-muted-foreground">
                {prospect.factCount} hidden facts
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
