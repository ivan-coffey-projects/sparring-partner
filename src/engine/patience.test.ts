import { describe, expect, it } from "vitest";
import { applyPatienceTurn, patienceBand } from "@/engine/patience";
import type {
  MoveAnalysis,
  PatienceConfig,
  TurnMetrics,
} from "@/engine/types";

const config: PatienceConfig = {
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
};

const neutralAnalysis: MoveAnalysis = {
  moveTypes: ["other"],
  reflectionTargets: [],
  pitchDetected: false,
  pressure: 0,
};

const shortTurn: TurnMetrics = { wordCount: 20, questionCount: 1 };

describe("applyPatienceTurn", () => {
  it("leaves patience unchanged on a neutral short turn", () => {
    const result = applyPatienceTurn(60, neutralAnalysis, shortTurn, 0, config);
    expect(result.value).toBe(60);
    expect(result.deltas).toEqual([]);
    expect(result.hangUp).toBe(false);
  });

  it("penalizes monologues per word over the threshold", () => {
    const result = applyPatienceTurn(
      60,
      neutralAnalysis,
      { wordCount: 130, questionCount: 0 },
      0,
      config,
    );
    // 40 words over × 0.25 = 10
    expect(result.value).toBe(50);
    expect(result.deltas).toEqual([{ reason: "monologue", amount: -10 }]);
  });

  it("penalizes pitching before the discovery gate", () => {
    const analysis: MoveAnalysis = {
      ...neutralAnalysis,
      moveTypes: ["pitch"],
      pitchDetected: true,
    };
    const early = applyPatienceTurn(60, analysis, shortTurn, 1, config);
    expect(early.value).toBe(46);
    expect(early.deltas).toEqual([{ reason: "early_pitch", amount: -14 }]);

    // Once the gate is met, the same pitch is free.
    const earned = applyPatienceTurn(60, analysis, shortTurn, 2, config);
    expect(earned.value).toBe(60);
  });

  it("penalizes blunt qualifying questions", () => {
    const analysis: MoveAnalysis = {
      ...neutralAnalysis,
      moveTypes: ["blunt_qualifying"],
    };
    const result = applyPatienceTurn(60, analysis, shortTurn, 0, config);
    expect(result.value).toBe(52);
    expect(result.deltas).toEqual([{ reason: "blunt_question", amount: -8 }]);
  });

  it("penalizes stacked questions (3+) computed from code metrics", () => {
    const result = applyPatienceTurn(
      60,
      neutralAnalysis,
      { wordCount: 30, questionCount: 3 },
      0,
      config,
    );
    expect(result.value).toBe(54);
    expect(result.deltas).toEqual([
      { reason: "stacked_questions", amount: -6 },
    ]);
  });

  it("penalizes pressure above 0.5, scaled", () => {
    const analysis: MoveAnalysis = { ...neutralAnalysis, pressure: 1 };
    const result = applyPatienceTurn(60, analysis, shortTurn, 0, config);
    // (1 - 0.5) × 2 × 10 = 10
    expect(result.value).toBe(50);
    expect(result.deltas).toEqual([{ reason: "pressure", amount: -10 }]);
  });

  it("restores patience for accurate reflections and open questions, capped", () => {
    const analysis: MoveAnalysis = {
      moveTypes: ["reflection", "open_question"],
      reflectionTargets: [{ topic: "incumbent", accuracy: 0.9 }],
      pitchDetected: false,
      pressure: 0,
    };
    const result = applyPatienceTurn(50, analysis, shortTurn, 0, config);
    // 7 (reflection) + 3 (open question) = 10 = maxRegenPerTurn
    expect(result.value).toBe(60);
    expect(result.deltas).toEqual([
      { reason: "accurate_reflection", amount: 7 },
      { reason: "open_question", amount: 3 },
    ]);
  });

  it("does not reward inaccurate reflections", () => {
    const analysis: MoveAnalysis = {
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "budget", accuracy: 0.3 }],
      pitchDetected: false,
      pressure: 0,
    };
    const result = applyPatienceTurn(50, analysis, shortTurn, 0, config);
    expect(result.value).toBe(50);
  });

  it("caps regen at maxRegenPerTurn", () => {
    const tightConfig: PatienceConfig = { ...config, maxRegenPerTurn: 5 };
    const analysis: MoveAnalysis = {
      moveTypes: ["reflection", "open_question"],
      reflectionTargets: [{ topic: "incumbent", accuracy: 1 }],
      pitchDetected: false,
      pressure: 0,
    };
    const result = applyPatienceTurn(50, analysis, shortTurn, 0, tightConfig);
    expect(result.value).toBe(55);
  });

  it("clamps to 0 and reports hang-up", () => {
    const analysis: MoveAnalysis = {
      ...neutralAnalysis,
      moveTypes: ["blunt_qualifying", "pitch"],
      pitchDetected: true,
      pressure: 1,
    };
    const result = applyPatienceTurn(
      5,
      analysis,
      { wordCount: 200, questionCount: 4 },
      0,
      config,
    );
    expect(result.value).toBe(0);
    expect(result.hangUp).toBe(true);
  });

  it("clamps to 100 at the top", () => {
    const analysis: MoveAnalysis = {
      moveTypes: ["reflection"],
      reflectionTargets: [{ topic: "x", accuracy: 1 }],
      pitchDetected: false,
      pressure: 0,
    };
    const result = applyPatienceTurn(98, analysis, shortTurn, 0, config);
    expect(result.value).toBe(100);
  });

  it("penalties and regen combine in one turn", () => {
    const analysis: MoveAnalysis = {
      moveTypes: ["reflection", "blunt_qualifying"],
      reflectionTargets: [{ topic: "budget", accuracy: 0.8 }],
      pitchDetected: false,
      pressure: 0,
    };
    const result = applyPatienceTurn(60, analysis, shortTurn, 0, config);
    // -8 (blunt) + 7 (reflection) = -1
    expect(result.value).toBe(59);
  });
});

describe("patienceBand", () => {
  it("maps values to bands", () => {
    expect(patienceBand(80)).toBe("engaged");
    expect(patienceBand(55)).toBe("engaged");
    expect(patienceBand(54)).toBe("cooling");
    expect(patienceBand(25)).toBe("cooling");
    expect(patienceBand(24)).toBe("impatient");
    expect(patienceBand(1)).toBe("impatient");
    expect(patienceBand(0)).toBe("done");
  });
});
