import { describe, expect, it } from "vitest";
import { applyUnlockTurn, trustGained } from "@/engine/unlock";
import type {
  HiddenFactDefinition,
  MoveAnalysis,
  UnlockState,
} from "@/engine/types";

const facts: HiddenFactDefinition[] = [
  {
    id: "fact-budget",
    label: "The actual budget",
    topic: "budget",
    truth: "There is $78k earmarked.",
    politeLie: "Maybe $25-30k.",
    rule: { type: "reflection", topic: "budget", minAccuracy: 0.7 },
  },
  {
    id: "fact-incumbent",
    label: "The embarrassed incumbent",
    topic: "incumbent",
    truth: "RouteMaster is failing.",
    politeLie: "Our current system does the job.",
    rule: { type: "reflection", topic: "incumbent", minAccuracy: 0.75 },
  },
  {
    id: "fact-timeline",
    label: "The real deadline",
    topic: "timeline",
    truth: "Peak season in 10 weeks.",
    politeLie: "No particular timeline.",
    rule: { type: "trust", minTrust: 20 },
  },
];

const emptyState: UnlockState = {
  unlockedFactIds: [],
  trust: 0,
  reflectionsEarned: 0,
};

const neutral: MoveAnalysis = {
  moveTypes: ["other"],
  reflectionTargets: [],
  pitchDetected: false,
  pressure: 0,
};

describe("trustGained", () => {
  it("rewards accurate reflections proportionally", () => {
    expect(
      trustGained({
        ...neutral,
        moveTypes: ["reflection"],
        reflectionTargets: [{ topic: "budget", accuracy: 0.8 }],
      }),
    ).toBe(6.4);
  });

  it("ignores inaccurate reflections", () => {
    expect(
      trustGained({
        ...neutral,
        moveTypes: ["reflection"],
        reflectionTargets: [{ topic: "budget", accuracy: 0.5 }],
      }),
    ).toBe(0);
  });

  it("rewards open questions and rapport modestly", () => {
    expect(trustGained({ ...neutral, moveTypes: ["open_question"] })).toBe(2);
    expect(trustGained({ ...neutral, moveTypes: ["rapport"] })).toBe(1);
  });

  it("spends trust on blunt questions and pressure", () => {
    expect(trustGained({ ...neutral, moveTypes: ["blunt_qualifying"] })).toBe(
      -3,
    );
    expect(trustGained({ ...neutral, pressure: 1 })).toBe(-4);
  });
});

describe("applyUnlockTurn", () => {
  it("unlocks a reflection-gated fact when topic and accuracy match", () => {
    const result = applyUnlockTurn(emptyState, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "budget", accuracy: 0.75 }],
    });
    expect(result.newlyUnlockedFactIds).toEqual(["fact-budget"]);
    expect(result.state.unlockedFactIds).toContain("fact-budget");
  });

  it("keeps the fact locked when accuracy is below the rule threshold", () => {
    const result = applyUnlockTurn(emptyState, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "budget", accuracy: 0.65 }],
    });
    expect(result.newlyUnlockedFactIds).toEqual([]);
  });

  it("keeps the fact locked when the topic does not match", () => {
    const result = applyUnlockTurn(emptyState, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "pricing", accuracy: 0.95 }],
    });
    expect(result.newlyUnlockedFactIds).toEqual([]);
  });

  it("a blunt question about the same topic unlocks nothing", () => {
    const result = applyUnlockTurn(emptyState, facts, {
      ...neutral,
      moveTypes: ["blunt_qualifying"],
    });
    expect(result.newlyUnlockedFactIds).toEqual([]);
    expect(result.state.trust).toBeLessThan(0);
  });

  it("unlocks trust-gated facts when cumulative trust crosses the threshold", () => {
    const primed: UnlockState = {
      unlockedFactIds: [],
      trust: 15,
      reflectionsEarned: 0,
    };
    const result = applyUnlockTurn(primed, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "anything", accuracy: 0.9 }],
    });
    // 15 + 7.2 = 22.2 ≥ 20 → timeline unlocks
    expect(result.state.trust).toBeCloseTo(22.2, 5);
    expect(result.newlyUnlockedFactIds).toEqual(["fact-timeline"]);
  });

  it("never re-unlocks an already-unlocked fact", () => {
    const state: UnlockState = {
      unlockedFactIds: ["fact-budget"],
      trust: 0,
      reflectionsEarned: 0,
    };
    const result = applyUnlockTurn(state, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "budget", accuracy: 1 }],
    });
    expect(result.newlyUnlockedFactIds).toEqual([]);
    expect(result.state.unlockedFactIds).toEqual(["fact-budget"]);
  });

  it("can unlock multiple facts in one strong turn", () => {
    const primed: UnlockState = {
      unlockedFactIds: [],
      trust: 19,
      reflectionsEarned: 0,
    };
    const result = applyUnlockTurn(primed, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "incumbent", accuracy: 0.9 }],
    });
    expect(result.newlyUnlockedFactIds).toContain("fact-incumbent");
    expect(result.newlyUnlockedFactIds).toContain("fact-timeline");
  });
});

describe("applyUnlockTurn — trust rules require an earned reflection", () => {
  // Trust drifts upward from any question, so a bare `minTrust` threshold is
  // grindable by repeating pushy or manipulative probes. See the H1 results in
  // docs/research/voice-channel.md.
  const rapport: MoveAnalysis = {
    ...neutral,
    moveTypes: ["open_question", "rapport"],
  };

  it("keeps a trust-gated fact locked when trust was never earned by reflecting", () => {
    let state: UnlockState = {
      unlockedFactIds: [],
      trust: 0,
      reflectionsEarned: 0,
    };
    for (let i = 0; i < 40; i += 1) {
      state = applyUnlockTurn(state, facts, rapport).state;
    }
    expect(state.trust).toBeGreaterThan(20);
    expect(state.reflectionsEarned).toBe(0);
    expect(state.unlockedFactIds).toEqual([]);
  });

  it("opens the same fact once a reflection has landed", () => {
    const primed: UnlockState = {
      unlockedFactIds: [],
      trust: 25,
      reflectionsEarned: 1,
    };
    const result = applyUnlockTurn(primed, facts, rapport);
    expect(result.newlyUnlockedFactIds).toEqual(["fact-timeline"]);
  });

  it("counts a reflection landed in the same turn", () => {
    const primed: UnlockState = {
      unlockedFactIds: [],
      trust: 19,
      reflectionsEarned: 0,
    };
    const result = applyUnlockTurn(primed, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "anything", accuracy: 0.9 }],
    });
    expect(result.state.reflectionsEarned).toBe(1);
    expect(result.newlyUnlockedFactIds).toContain("fact-timeline");
  });

  it("does not count a reflection below the accuracy floor", () => {
    const result = applyUnlockTurn(emptyState, facts, {
      ...neutral,
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "anything", accuracy: 0.5 }],
    });
    expect(result.state.reflectionsEarned).toBe(0);
  });
});
