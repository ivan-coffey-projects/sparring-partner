import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { methodologies, methodologyEntries } from "@/db/schema";
import type { MethodologyOption } from "@/components/coach/scorecard-form";

export function loadMethodologyOptions(): MethodologyOption[] {
  const all = db.select().from(methodologies).all();
  return all.map((m) => ({
    id: m.id,
    name: m.name,
    entries: db
      .select({
        id: methodologyEntries.id,
        number: methodologyEntries.number,
        title: methodologyEntries.title,
      })
      .from(methodologyEntries)
      .where(eq(methodologyEntries.methodologyId, m.id))
      .orderBy(asc(methodologyEntries.sortOrder))
      .all(),
  }));
}
