# Scoring and reviewer evidence base

Evidence reviewed 2026-08-19. This document supports the artifact reviewer's
rubrics, the channel scorecards, and the methodology-adherence checks. This
file is the source the seeded reviewer playbooks and rubric weights cite.

**Meta-finding that shapes every rubric here:** activity-shaped metrics (talk
ratio, filler words, call length) are weak or non-causal proxies;
behavior-shaped metrics (question quality, problem depth, next-step
commitment, multithreading, quantified value, indecision handling) carry the
real correlation with outcomes. Gong's 2025 revisit (1.8M+ opportunities)
found high performers hold a consistent 43:57 talk ratio across both won AND
lost deals — talk ratio is a trait of good reps, not a per-call win lever.
Score it as hygiene, never as a headline dimension.

Evidence tiers: **[M]** measured at scale with published numbers; **[V]**
vendor-claimed, plausible but unaudited; **[A]** anecdotal/thought-leadership;
**[D]** debunked or contradicted.

---

## A) Metric catalog (evidence-ranked)

### Calls — conversation mechanics
| Metric | Claimed effect | Source/scale | Tier |
|---|---|---|---|
| Talk-to-listen 43:57 (discovery ~46:54) | >65% rep talk ↔ lower win rate; 2025 revisit: hygiene band only | Gong Labs, 25K–519K calls; 2025 revisit 1.8M opportunities | [M] weak-causal — band 40–60%, penalize only extremes |
| Question count 11–14 on discovery | Peak success 11–14 targeted questions; <11 shallow; targeting + even spread matter more than count | Gong Labs, 519K discovery calls | [M] |
| Problems explored: 3–4 per discovery | Best win correlation at 3–4 problems covered deeply | Gong topic-detection study | [M] |
| Longest monologue ≤ ~2:30 | Long monologues ↔ lost deals | Gong benchmark + Labs | [M]/[V] |
| Speaker switches / interactivity | More switches → higher follow-up-meeting rate | Gong Labs | [M] |
| Filler words | **No correlation** with outcomes | Gong Labs | [M-null → [D] as a dimension] |
| "We" vs "I" language | +34% claims; contradictory across channels | Gong (older) | [A]/weak — not a scored dimension |
| Pricing timing 38–46 min into ~60-min demo; pricing on call 1 +10% | Defer in demos; transparent early in cycle; 3–4 buyer pricing mentions = peak | Gong Labs | [M] |
| Competitor mentioned early | +49% close odds (older); +32% enterprise (2024, 24M calls) | Gong | [M] |
| Next steps established at close | Consensus #1 call-close behavior; universally instrumented | Gong/Chorus | [M-directional] |
| Multithreading | Won deals 2x buyer contacts; +130% win on $50K+ deals | Gong 2025, 1.8M opportunities | [M] |
| Risk-reversal language | +32% win when reps proactively de-risk | Gong Labs | [M] (converges with JOLT) |
| Cold open "how've you been?" | 6.6x vs baseline | Gong, 90,380 cold calls | [M] (2019-era) |
| "The reason for my call is…" | 2.1x | Gong | [M] |
| "Did I catch you at a bad time?" | −40% | Gong | [M] (older) |
| Cold-call rep talk share | Gong 54–55% vs Chorus 44% on successful cold calls | conflicting | [M-conflicting] — score "rep drives with context + question", not ratio |
| Successful cold call ~7.5 min; prospect asks 2–3 questions | vs 132s average | Chorus, 35M calls (2020) | [M] |
| Call + voicemail lifts email reply | 1.81%→3.44%; voicemail 2.73%→5.87% | Gong 2024, 300M calls | [M] |

### Deal psychology / closing
| Metric | Effect | Source | Tier |
|---|---|---|---|
| JOLT indecision handling | 40–60% of qualified pipeline lost to no-decision; 56% of that from fear-of-failure; JOLT sellers win 31% vs 6% with highly indecisive buyers; firm recommendation vs option menu lifts win 18%→44% | Dixon & McKenna, *The JOLT Effect* (2022), 2.5M+ machine-scored calls | [M] — strongest recent evidence base |
| Quantified business case | 51% of won deals had quantified value; poor value = 35% of losses | Genius Drive / Ebsta x Pavilion 2025 | [V]/[M-survey] |
| Macro context | B2B win rates ~19% (2025) from 29% (2024) | Ebsta x Pavilion | [M-survey] |

### Email (cross-checked against docs/research/email-channel.md)
50–125 words (peak 75–100) [M]; reading level grade 3–5 (+36% Boomerang, +67%
Lavender claim) [M]/[V]; interest CTA cold ~15% booking vs −44% for time-ask,
flipping to 2.5x FOR direct calendar ask in active-deal stage (Gong 304K) [M]
— **stage-dependent, encode both directions**; Lavender A-grade composite
+27% reply [V-with-data]; subject ≤4 words lowercase priority-framed (Gong x
30MPC 2025); "mobile-unfriendly ties with no-question as #1 conversation
killer" (Lavender).

### SMS
Channel-level superiority stats are vendor-marketing-sourced [V]; behavior-level
B2B SMS evidence is the thinnest of any channel — flag in product copy as
consensus-based; borrow contact-center QA + email principles. (Details in
docs/research/sms-channel.md.)

### LinkedIn / DM
| Metric | Effect | Source | Tier |
|---|---|---|---|
| InMail <400 chars | +22% response (only 10% are this short); >1,200 chars −11% | LinkedIn's own data | [M] |
| Connection request WITHOUT note | 55–68% acceptance vs 28–45% with note (80K requests); note only with real shared context | ReactIn/Waalaxy analyses 2025–26 | [M-vendor] |
| Benchmarks | 28.5% acceptance; 3.0% note reply (declining 3.5%→2.2% = template saturation); 10.4% message reply | Expandi, 13.2M requests, May 2025–Apr 2026 | [M-vendor] |
| Personalized InMail | +30.5% response / +40% acceptance vs bulk | LinkedIn data | [M-vendor] |

### Unsupported claims excluded from product scoring
- Filler-word penalty (Gong null result).
- NTL "learning pyramid" (75% practice retention) — pseudoscience, no primary
  study. Deliberate-practice efficacy itself is real (Ericsson tradition).
- "80% of sales need 5+ follow-ups" / Rule of 7 — repeatedly cited without
  a traceable primary source.
- "57% of buying decision complete before contact" — disowned by its own
  researchers.
- "10x more likely to win with we/us" — no traceable source.
- Best day/time to cold call — inconsistent across datasets.
- Challenger's original research — real dataset, contested methodology
  (Columbia Business School critique). Treat adherence as customer-methodology
  fidelity, not evidence-backed causality.

---

## B) Reviewer rubric proposal

Structural template: **MaestroQA contact-center QA architecture** — weighted
sections of criteria + a small auto-fail section (compliance/fabrication) +
bonus criteria that can exceed 100%. Composes cleanly with the citation gate:
every scored criterion cites the artifact line.

### B1. Call transcript (10 dimensions)
1. Question quality & targeting — open questions tied to business problems;
   flag checklist-interrogation (all questions in first third); 11–14, spread
   evenly. (Gong 519K)
2. Problem depth — 3–4 distinct problems surfaced AND explored ≥2 layers.
   (Gong topic study)
3. Implication development — quantifies downstream cost after a problem is
   admitted. (SPIN/Huthwaite 35K calls: implication questions = strongest
   close predictor in large deals)
4. Dialogue balance & interactivity — rep talk 40–60%, longest monologue
   ≤2:30, speaker switches. Hygiene-weighted.
5. Next steps established — concrete date/time/owner/artifact before end;
   missing = heavy penalty. (Gong/Chorus consensus)
6. Multithreading motion — asks about stakeholders, requests intros, maps the
   committee. (Gong 1.8M opportunities)
7. Pricing handling — transparent, not dodged; in demos placed after value.
8. Competitor handling — surfaces landscape early rather than avoiding.
   (+32–49%)
9. Indecision & risk handling (JOLT) — distinguishes status-quo objection
   from fear-of-messing-up; firm recommendation over option-dumping;
   risk-reversal offer. (Dixon 2.5M; Gong +32%)
10. Cold-call variant (replaces 2,3,7) — context-rich opener + proactive
    reason (2.1x), no "bad time?" (−40%), rep drives, prospect asks ≥2
    questions, closes for a scheduled meeting.

### B2. Email thread (8 dimensions)
1. Brevity — <100 words cold / 50–125 general.
2. Readability — grade 3–5 Flesch-Kincaid.
3. CTA stage-fit — cold: interest ask, NOT calendar-time ask; active deal:
   direct specific scheduling ask. (Gong 304K — stage-dependent rule)
4. Personalized opener — first line about the recipient, not the sender.
5. Subject line — ≤4 words, sentence-case/lowercase, priority-framed.
6. One thread = one ask — single CTA, ≤1–2 questions (no-question emails die;
   question overload kills).
7. Mobile formatting — ≤2–3 line paragraphs, no walls.
8. Thread progression — follow-ups add new value vs "bumping"; next step gets
   concrete; multithreads when stalled.

### B3. SMS thread (6 dimensions — flag as consensus-based in product)
1. Identification + context tie-back (SMS is a follow-up channel).
2. Brevity — 1–3 sentences, single message per turn.
3. One clear question/CTA per message.
4. Timeliness — latency to inbound; business-appropriate hours.
5. Tone calibration — conversational, no pasted email prose, no
   ALL-CAPS/pressure.
6. Compliance auto-fail — opt-out ignored, cold-texting with no prior
   relationship, misleading identity → section score 0.

### B4. DM thread (7 dimensions)
1. Message length — opener <400 chars (+22%); penalize >800–1,200.
2. Connection-request judgment — blank request when no shared context; note
   only with earned context.
3. Personalization specificity — something only true of this prospect;
   template-pattern detection (reply rates fell 37% in 12 months from template
   saturation — Expandi 13.2M).
4. No pitch in first message — interest/permission ask.
5. Conversational reciprocity — responds to what the prospect said; no
   sequence-blasting through silence.
6. Ask escalation — concrete next step only after an engagement signal.
7. Channel-appropriate tone — mirrors platform informality; no email-formal
   blocks.

---

## C) Methodology-adherence checks (detectable markers)

**MEDDPICC** (enterprise SaaS dominant; ~73% of $100K+ ACV orgs claimed [V];
+18% win rate for full adopters [V]): Metrics = quantified KPIs elicited;
Economic buyer = budget owner identified + access path; Decision criteria +
process = evaluation steps/approvers/timeline asked; Paper process =
legal/procurement/security discussed; Identify pain = pain articulated by the
*buyer*; Champion = internal seller tested; Competition = alternatives incl.
status quo asked. Grader = coverage checklist with buyer-utterance citations
(the Gong Smart Trackers / Attention / Oliv / Hyperbound pattern).

**SPIN** (Huthwaite, 35K calls): Situation questions FEW (over-asking
correlates negatively); Problem questions → buyer admits difficulty;
Implication questions → consequences/cost extended (high-signal marker, top
performers 4x average); Need-payoff → buyer states the value themselves;
benefits tied to stated needs; NO classic closing techniques (counterproductive
in large sales).

**Challenger** (fidelity only; research contested): Teach = insight/reframe
led with an unexpected data point about *their* business; Tailor = per
stakeholder role; Take control = direct on pricing/process, drives next
steps, constructive tension without capitulating.

**Sandler:** Up-front contract (agenda + time + mutual outcomes at start);
Pain funnel (deepening sequence "tell me more → what did that cost → how do
you feel"); budget before proposal; decision process before demo; negative
reversing / permission to say no; no unpaid consulting.

**Gap Selling:** Current state with facts AND quantified impact; future state
articulated by buyer; gap explicitly quantified; root-cause probing; no
demo/pitch before full diagnosis.

**JOLT** (late-stage layer, most recent evidence-based): Judge indecision
(probe WHICH source: valuation / lack of info / outcome uncertainty — NOT
re-selling ROI, which backfires); Offer recommendation (firm and specific,
18%→44%); Limit exploration (cap extra demos/research, position as expert);
Take risk off the table (pilots, opt-outs, guarantees — converges with Gong
+32%).

**Value selling / ROI:** quantified case built from buyer's own numbers;
cost-of-inaction articulated; marker = rep converts stated pain into a
dollar/time figure and gets buyer confirmation.

---

## D) Sources & competitor intel

Measured-at-scale: Gong Labs corpus 2017–2026 (25K–300M calls, 1.8M–7.1M
opportunities; correlational, self-published, 2025 internal revisit); *The JOLT
Effect* (2022, 2.5M+ calls, book-length methodology); Rackham *SPIN Selling*
(1988, 35K calls — the only academically styled observational study);
Boomerang 2016 (40M emails); Chorus State of CI 2020 (35M calls); Expandi
2025–26 (13.2M requests); LinkedIn's own InMail data; nimitai talk-ratio
regression (n=350 — small, but the only public regression separating talk
ratio from question count: open-question β=0.41 vs talk-ratio β=−0.27).

Vendor rubrics (competitor intel, directly relevant): **Hyperbound**
(scorecards: talk ratio, tonality, key selling moments, objection resolution,
methodology adherence MEDDIC/SPIN/BANT/Challenger/custom); **Quantified.ai**
("1,400+ behavioral dimensions", knowledge-vs-delivery split — the split is
the useful pattern); **Second Nature** (discovery depth, quantifying pain,
competitive positioning, objection handling, next-step setting; **70%
knowledge / 30% style default weighting** — reusable prior); **Luster.ai**
(skill-gap prediction from imported real calls); Attention/Clari/Oliv/Avoma
(auto-scoring MEDDIC/BANT/SPICED from transcripts —
coverage-checklist-with-citations is the industry pattern); **MaestroQA**
(scorecard architecture: weighted sections, bonus >100%, auto-fail sections).

Outcome metrics buyers of training measure: win rate, ramp (median AE 5.3
months, Bridge Group 2024), quota attainment (57.3% vs 46.7% with/without
enablement function). Role-play efficacy: vendor claims +24% (SRG), 20–45%
win-rate lifts — none peer-reviewed; cite the deliberate-practice literature
(Ericsson), never the NTL pyramid.

Debunk sources: Columbia Business School "Revisiting the Challenger Sale"
(2015); inversion.agency sales-myth analysis; anartfulscience.com Rule-of-7 origin;
Gong's own filler-word null result.

**Conflicts to preserve in rubric design:** (1) Gong 54–55% vs Chorus 44% rep
talk on successful cold calls — score behavior, not ratio; (2) talk ratio
consistent-across-outcomes for top reps — hygiene not headline; (3) CTA
direction flips between cold and active-deal stage — the rubric must know the
artifact's funnel stage before scoring the ask; (4) SMS has no at-scale B2B
behavioral evidence — mark that section's provenance honestly in the product.
