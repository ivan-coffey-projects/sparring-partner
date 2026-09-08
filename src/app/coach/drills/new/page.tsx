import { DrillForm } from "@/components/coach/drill-form";
import { loadDrillFormOptions } from "@/lib/drill-queries";

export const metadata = { title: "New drill" };
// Reads the database through its form-options query, so it must never be
// prerendered: a build would otherwise open and migrate one as a side
// effect of rendering.
export const dynamic = "force-dynamic";

export default async function NewDrillPage() {
  const options = loadDrillFormOptions();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">New drill</h1>
      <DrillForm
        options={options}
        initial={{
          id: null,
          title: "",
          channel: "call",
          briefing: "",
          prospectId: options.prospects[0]?.id ?? "",
          scorecardId: options.scorecards[0]?.id ?? "",
          repIds: [],
        }}
      />
    </div>
  );
}
