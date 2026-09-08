import { ScorecardForm } from "@/components/coach/scorecard-form";
import { loadMethodologyOptions } from "@/lib/coach-queries";

export const metadata = { title: "New scorecard" };
// Reads the database through its form-options query, so it must never be
// prerendered: a build would otherwise open and migrate one as a side
// effect of rendering.
export const dynamic = "force-dynamic";

export default async function NewScorecardPage() {
  const options = loadMethodologyOptions();
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        New scorecard
      </h1>
      <ScorecardForm
        methodologies={options}
        initial={{
          id: null,
          name: "",
          methodologyId: options[0]?.id ?? "",
          criteria: [
            {
              id: null,
              label: "",
              description: "",
              weight: 1,
              methodologyEntryIds: [],
            },
          ],
        }}
      />
    </div>
  );
}
