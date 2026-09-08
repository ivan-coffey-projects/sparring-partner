import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { prospects, scorecards, users } from "@/db/schema";
import type { DrillFormOptions } from "@/components/coach/drill-form";

export function loadDrillFormOptions(): DrillFormOptions {
  return {
    prospects: db
      .select({
        id: prospects.id,
        name: prospects.name,
        company: prospects.company,
      })
      .from(prospects)
      .all(),
    scorecards: db
      .select({ id: scorecards.id, name: scorecards.name })
      .from(scorecards)
      .all(),
    reps: db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.role, "rep"))
      .all(),
  };
}
