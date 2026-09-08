import { ProspectForm } from "@/components/coach/prospect-form";
import type { ProspectPayload } from "@/app/coach/actions";

export const metadata = { title: "New prospect" };

const BLANK: ProspectPayload = {
  id: null,
  name: "",
  jobTitle: "",
  company: "",
  persona: "",
  dealContext: "",
  openingLine: "",
  patienceConfig: {
    initial: 60,
    monologueWordThreshold: 90,
    monologuePenaltyPerWord: 0.25,
    earlyPitchPenalty: 14,
    discoveryGate: 2,
    bluntQuestionPenalty: 8,
    stackedQuestionPenalty: 6,
    pressurePenaltyScale: 10,
    reflectionRegen: 7,
    openQuestionRegen: 3,
    maxRegenPerTurn: 10,
  },
  concessionCaps: {
    meetingRequiresFactsUnlocked: 2,
    meetingRequiresPatienceAtLeast: 40,
    allowIntro: true,
    introRequiresFactsUnlocked: 3,
    allowPilot: false,
    maxPilotBudget: 0,
    pilotRequiresFactsUnlocked: 5,
    allowTimelineChange: false,
    maxConcessionsTotal: 2,
  },
  facts: [
    {
      id: null,
      label: "",
      topic: "",
      truth: "",
      politeLie: "",
      unlockRule: { type: "reflection", topic: "", minAccuracy: 0.7 },
    },
  ],
};

export default function NewProspectPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">New prospect</h1>
      <p className="mt-1 mb-6 text-sm text-muted-foreground">
        Model it on a deal your clients are losing right now.
      </p>
      <ProspectForm initial={BLANK} />
    </div>
  );
}
