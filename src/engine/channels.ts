import type { AsyncChannel, EngagementConfig } from "@/engine/types";

/**
 * Research-derived engagement defaults per async channel. Every value traces
 * to docs/research/{sms,email,social-dm}-channel.md — the numbers are
 * deterministic engine knobs derived from measured effects, not vibes.
 * The prospect's `patienceConfig.initial` still sets starting engagement so
 * trainers tune difficulty per persona without new schema.
 */
const SMS: EngagementConfig = {
  // sms-channel.md A4: ≤100 chars = 2–5x response; 160 = one segment;
  // ≥320 (multi-segment wall) → short/cold reply or none.
  idealMaxChars: 160,
  perCharPenalty: 0.04,
  hardMaxChars: 320,
  wallOfTextPenalty: 12,
  // A3: pitch-first cold text ≈ −5% vs +112.6% after contact — the largest
  // sequencing effect in the SMS literature.
  pitchFirstTouchPenalty: 18,
  // A5: message with no question/CTA → reply probability × ~0.5.
  noQuestionPenalty: 6,
  stackedQuestionPenalty: 6,
  multiCtaPenalty: 5,
  spamSignalPenalty: 3,
  selfFocusPenalty: 4,
  pressurePenaltyScale: 10,
  // A5: "just checking in" is a measured reply-killer.
  guiltTripPenalty: 8,
  // A9: 48h–3 days between follow-ups holds reply probability near baseline.
  minFollowUpGapMinutes: 48 * 60,
  tooSoonFollowUpPenalty: 10,
  noNewValuePenalty: 8,
  relevanceRegen: 6,
  reflectionRegen: 7,
  // A5: one specific low-friction question → 74–92% reply from engaged leads.
  clearCtaRegen: 4,
  patientFollowUpRegen: 6,
  maxRegenPerTurn: 10,
  replyThreshold: 40,
  // A8: >5 total unanswered → permanent ghost; 3+ in 24h → annoyance.
  ghostAfterUnanswered: 4,
  // A12: pushing past a soft no / pressure at low interest → STOP.
  optOutBelowEngagement: 25,
  // A7: engaged prospects reply in 1–15 min during business hours.
  replyDelayMinutes: { fast: 2, medium: 25, slow: 240 },
};

const EMAIL: EngagementConfig = {
  // email-channel.md B2: 50–100 words full marks (~750 chars), steep
  // penalty >125 words; hard wall ~250 words.
  idealMaxChars: 750,
  perCharPenalty: 0.01,
  hardMaxChars: 1500,
  wallOfTextPenalty: 10,
  // A2: self-focused/pitch-heavy first touch collapses reply probability.
  pitchFirstTouchPenalty: 12,
  // B4/Lavender: no-question emails die; question overload also kills.
  noQuestionPenalty: 5,
  stackedQuestionPenalty: 5,
  // B4: one CTA only (Instantly 2026).
  multiCtaPenalty: 6,
  // B5: trigger words, subject-weighted (subject hits count double).
  spamSignalPenalty: 4,
  // B3: I/we-vs-you ratio; first sentence about the sender = penalty.
  selfFocusPenalty: 6,
  pressurePenaltyScale: 8,
  // B6 (Gong 304K): "Thoughts?" −20% meetings, "never heard back" −14%.
  guiltTripPenalty: 7,
  // B6: ≥2–3 business days before following up (90% of replies land <1 day).
  minFollowUpGapMinutes: 48 * 60,
  tooSoonFollowUpPenalty: 9,
  noNewValuePenalty: 7,
  // B3: relevance is the top lever (~2x replies for load-bearing
  // personalization; 73% of buyers avoid irrelevant senders).
  relevanceRegen: 7,
  reflectionRegen: 6,
  clearCtaRegen: 4,
  patientFollowUpRegen: 6,
  maxRegenPerTurn: 11,
  replyThreshold: 45,
  // A4: sequences past 4 unanswered touches triple complaint risk.
  ghostAfterUnanswered: 4,
  optOutBelowEngagement: 22,
  // A3: median reply 2–4 business hours, 90th percentile ~24h.
  replyDelayMinutes: { fast: 150, medium: 720, slow: 2400 },
};

const DM_INSTAGRAM: EngagementConfig = {
  // social-dm-channel.md §1 A4: multiple short messages, not paragraphs;
  // 1,000-char platform cap; wall-of-text is a documented ghost trigger.
  idealMaxChars: 240,
  perCharPenalty: 0.03,
  hardMaxChars: 500,
  wallOfTextPenalty: 12,
  // §1 A6: instant pitch or link in message 1 pattern-matches the MLM
  // script → "who is this?" or silent block.
  pitchFirstTouchPenalty: 16,
  // §1 A7: question-first openers are the positive trigger.
  noQuestionPenalty: 6,
  stackedQuestionPenalty: 5,
  multiCtaPenalty: 5,
  // §1 A6: urgency phrases / hype markers feed the spam score.
  spamSignalPenalty: 4,
  selfFocusPenalty: 5,
  pressurePenaltyScale: 10,
  guiltTripPenalty: 7,
  // §1 A3: session-based rhythm; between-session gaps are hours-to-a-day.
  minFollowUpGapMinutes: 24 * 60,
  tooSoonFollowUpPenalty: 8,
  noNewValuePenalty: 7,
  // §1 B: swap-test specificity is the top rubric weight (30/100).
  relevanceRegen: 7,
  reflectionRegen: 6,
  // §1 A7: permission-based ask ("want me to share how I'd approach it?").
  clearCtaRegen: 4,
  patientFollowUpRegen: 5,
  maxRegenPerTurn: 10,
  replyThreshold: 40,
  // §1 A5: ghost culture is strong; seen-then-silent is normal.
  ghostAfterUnanswered: 3,
  optOutBelowEngagement: 20,
  // §1 A3: minutes–hours inside a session; next-day between sessions.
  replyDelayMinutes: { fast: 5, medium: 90, slow: 1200 },
};

const PROFESSIONAL_DM: EngagementConfig = {
  // social-dm-channel.md §2 A3 (LinkedIn's own corpus): <400 chars +22%,
  // 800–1,200 −6%, >1,200 −11%.
  idealMaxChars: 400,
  perCharPenalty: 0.015,
  hardMaxChars: 1200,
  wallOfTextPenalty: 8,
  // §2 A6: an immediate pitch after connection reduces replies to ≤2% and can
  // connection withdrawal. The strongest single penalty on this channel.
  pitchFirstTouchPenalty: 20,
  noQuestionPenalty: 4,
  stackedQuestionPenalty: 5,
  multiCtaPenalty: 5,
  spamSignalPenalty: 3,
  // §2 A7 homework gate: 79% won't engage a seller who doesn't know their
  // company — the message must be about them.
  selfFocusPenalty: 6,
  pressurePenaltyScale: 9,
  guiltTripPenalty: 7,
  // §2 A4/B10: buyer median reply ≈ 22h — following up within hours of
  // silence is itself a penalty; follow-ups are spaced days apart.
  minFollowUpGapMinutes: 72 * 60,
  tooSoonFollowUpPenalty: 9,
  noNewValuePenalty: 7,
  // §2 A7: 93% more likely to engage with personalized communication.
  relevanceRegen: 8,
  reflectionRegen: 6,
  // §2 A8: interest-based CTA ~2x vs hard calendar ask.
  clearCtaRegen: 4,
  patientFollowUpRegen: 6,
  maxRegenPerTurn: 11,
  replyThreshold: 45,
  // §2 B8: stop by touch 5–6; 40–60% of replies come from touches 2–4.
  ghostAfterUnanswered: 4,
  optOutBelowEngagement: 18,
  // §2 A4: lognormal, median ≈ 22h, tail to days; never minutes-fast.
  replyDelayMinutes: { fast: 240, medium: 1320, slow: 4320 },
};

const CONFIGS: Record<AsyncChannel, EngagementConfig> = {
  sms: SMS,
  email: EMAIL,
  dm_instagram: DM_INSTAGRAM,
  dm_linkedin: PROFESSIONAL_DM,
};

export function engagementConfigFor(channel: AsyncChannel): EngagementConfig {
  return CONFIGS[channel];
}
