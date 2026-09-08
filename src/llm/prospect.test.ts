import { describe, expect, it } from "vitest";
import { assembleProspectSystemPrompt } from "@/llm/prospect";
import { CHANNELS, type HiddenFactDefinition } from "@/engine/types";

const persona = {
  name: "Dana Whitfield",
  jobTitle: "VP of Operations",
  company: "Corvid Freight",
  persona: "Sharp and busy.",
};

function fact(
  id: string,
  topic: string,
  truth: string,
  politeLie: string,
): HiddenFactDefinition {
  return {
    id,
    label: `Fact ${id}`,
    topic,
    truth,
    politeLie,
    rule: { type: "reflection", topic, minAccuracy: 0.7 },
  };
}

const facts: HiddenFactDefinition[] = [
  fact("f1", "budget", "SECRET-BUDGET-78K earmarked in ops line", "Maybe $25k."),
  fact("f2", "incumbent", "SECRET-ROUTEMASTER is failing badly", "It works fine."),
  fact("f3", "timeline", "SECRET-DEADLINE ten weeks to peak season", "No timeline."),
];

describe("assembleProspectSystemPrompt — information hiding", () => {
  it("includes NO locked truth, in any form", () => {
    const prompt = assembleProspectSystemPrompt({
      persona,
      channel: "call",
      facts,
      unlockedFactIds: [],
      newlyUnlockedFactIds: [],
      patience: 60,
    });
    expect(prompt).not.toContain("SECRET-BUDGET-78K");
    expect(prompt).not.toContain("SECRET-ROUTEMASTER");
    expect(prompt).not.toContain("SECRET-DEADLINE");
    // The polite lies ARE present — they're the only script for locked topics.
    expect(prompt).toContain("Maybe $25k.");
    expect(prompt).toContain("It works fine.");
  });

  it("includes exactly the unlocked truths", () => {
    const prompt = assembleProspectSystemPrompt({
      persona,
      channel: "call",
      facts,
      unlockedFactIds: ["f2"],
      newlyUnlockedFactIds: ["f2"],
      patience: 60,
    });
    expect(prompt).toContain("SECRET-ROUTEMASTER");
    expect(prompt).not.toContain("SECRET-BUDGET-78K");
    expect(prompt).not.toContain("SECRET-DEADLINE");
    // An unlocked fact's polite lie is no longer scripted.
    expect(prompt).not.toContain("It works fine.");
  });

  it("property: random unlock subsets never leak a locked truth, on any channel", () => {
    for (let i = 0; i < 64; i++) {
      const unlocked = facts.filter(() => Math.random() < 0.5).map((f) => f.id);
      const channel =
        CHANNELS[Math.floor(Math.random() * CHANNELS.length)];
      const prompt = assembleProspectSystemPrompt({
        persona,
        channel,
        facts,
        unlockedFactIds: unlocked,
        newlyUnlockedFactIds: [],
        patience: Math.floor(Math.random() * 101),
      });
      for (const f of facts) {
        if (unlocked.includes(f.id)) {
          expect(prompt).toContain(f.truth);
        } else {
          expect(prompt).not.toContain(f.truth);
        }
      }
    }
  });

  it("carries the patience band into the mood directive", () => {
    const engaged = assembleProspectSystemPrompt({
      persona,
      channel: "call",
      facts,
      unlockedFactIds: [],
      newlyUnlockedFactIds: [],
      patience: 80,
    });
    const impatient = assembleProspectSystemPrompt({
      persona,
      channel: "call",
      facts,
      unlockedFactIds: [],
      newlyUnlockedFactIds: [],
      patience: 10,
    });
    expect(engaged).toContain("You're engaged");
    expect(impatient).toContain("close to hanging up");
  });
});
