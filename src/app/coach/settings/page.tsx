import { isMockMode, modelLabel } from "@/llm/models";
import { Badge } from "@/components/ui/badge";
import appPackage from "../../../../package.json";

export const metadata = { title: "Settings" };

const ROLES = [
  {
    role: "prospect" as const,
    title: "Prospect",
    description: "Speaks as the buyer during live calls. Fast and cheap is fine.",
  },
  {
    role: "analyzer" as const,
    title: "Analyzer",
    description:
      "Silently classifies each rep move against the hidden file. Never speaks.",
  },
  {
    role: "grader" as const,
    title: "Grader",
    description:
      "Grades transcripts after the call. Use your strongest model here.",
  },
];

export default async function SettingsPage() {
  const mock = isMockMode();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Models are configured through environment variables on your deployment
        — keys never live in the database. See <code>.env.example</code> in the
        repository.
      </p>

      {mock ? (
        <div className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-medium">
            Mock mode is on{" "}
            <Badge variant="outline" className="ml-1 font-mono text-[10px]">
              SP_MOCK_LLM=1
            </Badge>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            All three roles use deterministic scripted models — no API keys
            needed. Great for trying the product; switch to a real provider for
            actual training.
          </p>
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {ROLES.map((entry) => (
          <div
            key={entry.role}
            className="flex items-center justify-between gap-4 rounded-xl border bg-card p-4"
          >
            <div>
              <p className="text-sm font-medium">{entry.title}</p>
              <p className="text-xs text-muted-foreground">
                {entry.description}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 font-mono text-xs">
              {modelLabel(entry.role)}
            </Badge>
          </div>
        ))}
      </div>

      <section className="mt-10 rounded-xl border bg-card p-5">
        <p className="label-micro text-muted-foreground">About</p>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          Sparring Partner {appPackage.version}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Self-hosted sales-training gym. Conversations stay on this host.
          Provider keys stay in environment variables. This product simulates
          practice only — it never contacts real leads.
        </p>
        <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
          Proprietary · all rights reserved
        </p>
      </section>
    </div>
  );
}
