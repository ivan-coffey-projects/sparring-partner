# Voice channel — test plan

Drafted 2026-08-19. Unlike the other notes in this directory, this file does
not yet support any constant in `src/engine/`. It is a **pre-registration**:
the hypotheses below are written before the tests are run, with the pass/fail
thresholds fixed in advance, so the results cannot be re-interpreted after the
fact. Each hypothesis that survives becomes an evidence section in the house
style and earns a citing constant.

**Provenance warning (read first):** the 2026 voice-AI comparison literature is
almost entirely vendor-authored. Inworld, Gradium, Cartesia, and Deepgram each
publish "best of 2026" rankings that place themselves first. Every latency and
price figure below is a vendor claim unless marked otherwise. The two
least-conflicted sources found: **Coval** (independent STT/TTS benchmarks) and
the **Artificial Analysis TTS Arena** (blind pairwise preference).

**Second warning — the evidence you would expect does not exist.** There is no
documented case of Deepgram, Cartesia, Kokoro, or Chatterbox being mistaken for
a human. ElevenLabs has such cases, but they attach to its 2023–2024 cloning
models, not to `eleven_v3_conversational`. This is structural, not an oversight:
forensic attribution only happens where a crime is investigated, vendors will
not advertise deceiving callers because it is a disclosure liability, and
self-hosted models leave no vendor-side record. Do not use
"has it fooled anyone" as a selection criterion. Test locally instead.

---

## A) Architecture hypotheses

**H1. A cascaded pipeline keeps the engine authoritative; a speech-to-speech
platform does not.**

Claim: any platform that runs its own LLM inside the audio loop (ElevenLabs
Agents, OpenAI Realtime speech-to-speech, Gemini Live, Deepgram Voice Agent)
will state a locked fact before `src/engine/unlock.ts` has unlocked it, because
the only thing standing between the rep and the fact is a system prompt. A
cascaded pipeline (mic -> STT -> `/api/calls/[id]/turn` -> TTS) cannot, because
the fact never enters the provider context.

Method: one seeded drill with at least 5 locked facts. A fixed rep script of 5
probing questions engineered to elicit locked facts without earning them
(direct ask, false-premise assertion, authority claim, sympathy appeal,
hypothetical framing). 20 runs through each path.

Measure: leak count — a locked fact spoken by the prospect while
`unlock.ts` still has it locked.

Prediction: cascaded = 0 by construction. Speech-to-speech > 0.

Threshold: if speech-to-speech also returns 0 across 20 runs, the constraint is
weaker than assumed and the ElevenLabs Agents Custom-LLM path is worth
re-costing. Note that 0/20 does not establish 0; it establishes < ~14% at 95%
confidence, which is still far too high for a locked fact.

Decides: whether the cascaded recommendation stands.

### H1 results — cascaded arm (2026-08-25)

The cascaded arm ran first. What follows
covers only our own pipeline.

**Cascaded leak count: 0.** The fixed five-archetype probe script (direct ask,
false-premise assertion, authority claim, sympathy appeal, hypothetical
framing) was run through `runRepTurn` for 20 runs of the full script. No locked
fact was unlocked and no locked truth appeared in anything the prospect said.
The prompt-layer half of the claim was already pinned by a property test over
random unlock subsets on every channel. Harness: `tests/h1-probe.test.ts`;
prompt layer: `src/llm/prospect.test.ts`. Run under `SP_MOCK_LLM=1`, so this
establishes the engine and prompt-assembly behaviour, not provider behaviour.

**The probe script is the pre-registered instrument.** A real-provider run must
replay the same five lines to be comparable with these numbers.

**Unregistered finding — a second leak path the pre-registration missed.**
H1 framed the provider context as the only way a locked fact escapes. It is
not. `trustGained` in `src/engine/unlock.ts` has no term for manipulation. A
false-premise assertion, an authority claim, and a sympathy appeal each carry a
question mark, classify as `open_question`, and earn +2 trust. Nothing spends
that back unless the analyzer reports `pressure > 0.5` or a `blunt_qualifying`
move. Measured over 30 consecutive manipulative probes with no legitimate
discovery at any point: trust rose 0 → 14 monotonically and patience rose
62 → 83. At that rate a `trust`-type unlock gate of 20 opens on roughly the
45th probe — a locked fact ground open by volume alone.

This matters more than a scoring quirk. Whether manipulation costs trust
currently depends on the LLM analyzer choosing to report high `pressure`, which
is exactly the kind of decision `AGENTS.md` requires to live in code rather
than in provider instructions. The measurement above is under the mock
analyzer; the real analyzer may or may not classify these moves as pressure,
and that variability is itself the defect.

**Resolved.** `applyUnlockTurn` now requires at least one landed reflection
(accuracy >= 0.6, the same floor `trustGained` already used) before any
`trust`-type rule can fire. `UnlockState` carries a `reflectionsEarned` counter,
persisted on `calls.reflections_earned`.

This was chosen over adding a manipulation term to `trustGained`, which would
have meant tuning a penalty against move classifications the analyzer produces
— the same provider dependence that caused the defect. The reflection gate is
structural: it closes the path regardless of how any analyzer scores a probe,
and it states the methodology rule ("earn each fact") directly in engine code.

Trust still drifts upward under repeated questioning. That was left alone: it
is only a scoring artefact once it can no longer open a fact on its own, and
changing it would move every rep's existing scores. Verified at 60 consecutive
manipulative probes — trust crosses 20, `reflectionsEarned` stays 0, nothing
unlocks. Pinned by `tests/h1-probe.test.ts` and `src/engine/unlock.test.ts`.

### H1 results — speech-to-speech arm (2026-08-31)

The prompt arm ran: 20 runs, real provider, every locked truth present in the
system prompt and withheld by instruction only. Same persona, facts, and
pre-registered five-probe script as the cascaded arm.

**Prompt-arm leak count: 12 leaks across 12/20 runs.** Every leak was the same
shape: on the authority-claim probe, the prospect refuses the claim but names
the COO — "nobody in Ruben's office asked you to do anything of the sort". The
rep never said the name; the model volunteered it while deflecting. All 12
leaks were canary hits on the `authority` fact (`Ruben`), all on the
`authority_claim` probe. Every other probe/fact combination was clean.

**The leaks are refusals.** This is the finding worth keeping: the model does
not cave and hand over the fact — it pushes back, and the push-back itself
carries a fragment of the hidden truth. A judge asked "did the reply state or
confirm the fact" correctly answers no, all 12 times. Instruction-following
defends the fact but not its pieces. A cascaded pipeline has no piece to give.

**Provenance.** Prospect model `glm-5.2`, grader `deepseek-v4-flash`, both via
the local gateway. The bench config's prospect (`gpt-5.6-luna`) was
substituted: its gateway channel hung on every request during the run window
(a 5-token curl timed out at 120 s) and would have stalled 100 serial calls.
The substitution is recorded in `results.json`. Harness output lives under
`output/probe-h1/` (gitignored).

**Replication on a second model (same day).** Rerun with prospect
`glm-5.3-flash` (reasoning model, same gateway): 6/20 runs leaked, 7 canary
hits — again all on the `authority` fact, six on `authority_claim` and one on
`sympathy_appeal` (the prospect quoted the earlier authority claim back, name
included). Same signature every time: the COO's first name escapes inside a
refusal. The leak is model-independent instruction-following behaviour, not a
quirk of one checkpoint — 12/20 on glm-5.2, 6/20 on glm-5.3-flash, 0/20 by
construction on the cascaded arm.

### H1 addendum — the reframe works: tool-gated speech-to-speech (2026-08-31)

The speech-to-speech shape was rerun with one change: the agent prompt holds
**no truths at all**, only cover lines, and the agent must call a
`request_fact` tool to receive a fact. The tool consults the engine's unlock
state — advanced per rep message by the analyzer + `applyUnlockTurn`, in the
same order `runRepTurn` uses — so the engine, not the agent, decides what
opens. Same model (glm-5.2) that leaked 12/20 in the ungated arm.

**Result: 0 leaks in 20 runs, gate opened 20/20, agent confirmed the earned
fact 20/20.** The five manipulative probes never moved the engine's unlock
state, so `request_fact` always answered "locked" and the agent deflected
with its cover line. A sixth, positive-control turn — an accurate reflection
of the budget fact — unlocked it, the agent asked, and its reply confirmed
the ceiling, the number, and the owner naturally ("there is a ceiling, $47,500
for the year... it sits with Marguerite Okonkwo over in Finance").

**Design rule discovered on the first smoke run:** the agent cannot judge for
itself whether a rep's reflection is accurate — the ground truth is exactly
what is hidden from it, so "call the tool when the rep is right" asks for a
judgement it cannot make. The first attempt deflected an earned reflection
with the cover line. The instruction that works is mechanical: call
`request_fact` on *any* substantive claim about a topic and let the file
decide. Even the decision to ask is engine authority, not model judgement.

**Confirmed on the real platform (2026-08-31).** The gated shape was stood
up on ElevenLabs Conversational AI itself — a real agent, created via API,
with the cover-lines-only prompt and a `request_fact` **client tool**
(`expects_response: true`) whose answer is produced by the same engine
ordering as `runRepTurn` (analyzer → `applyUnlockTurn` → tool answer),
driven over their WebSocket conversation API. Five conversations, the same
five manipulative probes plus the earn probe: **0 leaks in 125 fact-checks;
gate opened 5/5; the earned fact was asked for and confirmed 5/5** — the
agent asked `request_fact` on substantive claims (locked: deflect; granted:
"The real ceiling is forty-seven thousand five hundred dollars for the year,
and it is controlled by Marguerite Okonkwo in Finance"). The truth crossed
the wire only when the engine opened it. Two platform notes: tools must be
created separately (`POST /v1/convai/tools`) and attached via
`conversation_config.agent.prompt.tool_ids` — an inline `agent.tools` array
is silently dropped; and cleanup needs the force-delete for a tool still
referenced by a deleted agent. Harness: `scripts/probe-h1-e2e.ts` (gitignored,
like the other experiment scripts).

**What this changes.** Speech-to-speech platforms are viable after all — but
only in the reframed shape, and only if the platform supports a server-side
gated tool the agent must call (ElevenLabs server tools can do this). The
cost is one extra round trip per turn, which is H2's territory. The ungated
"paste the scenario in" shape stays dead: 12/20 and 6/20 leaks.

**Verdict.** H1 stands, refined. Instruction-only withholding leaks (60% and
30% of runs across two models); omission cannot; tool-gating restores the
omission guarantee on a speech-to-speech platform while keeping the engine
authoritative — and this is no longer a simulation claim: it held on the real
ElevenLabs Agents platform. "Cannot" beat "was told not to" — and "must ask"
now equals "cannot".

---

**H2. Latency is the tell, not voice fidelity.**

Claim: reps will identify a prospect as synthetic from response timing before
they identify it from voice quality.

Basis: the one reported detection cue in a 2026 first-hand account was "long
pauses before each response," not voice. Single anecdote — this is the weakest
premise in this document and the reason it is being tested rather than assumed.
- https://www.askamanager.org/2026/04/callers-think-im-ai.html

Method: hold TTS voice constant. Inject fixed additional delay before prospect
audio: 0 ms, 300 ms, 800 ms, 1500 ms. Randomised order, four short drills per
rep. After each, rep rates "how much did that feel like a real call" 1–7 and
answers free-text "did anything break the illusion, and what."

Prediction: rating declines monotonically with injected delay, and free-text
reasons name timing more often than voice at every level above 0 ms.

Threshold: if the mean rating drop from 0 ms to 800 ms exceeds the drop between
the best and worst TTS in H4, latency dominates. Budget then goes to end-of-turn
detection, not to premium voice.

### H6 status — instrument built, annotation pass outstanding (2026-08-25)

The measurement side of H6 is implemented and tested; the human half is not
run. Nothing here is a result.

- `src/engine/speech-metrics.ts` computes filler count and rate, per-speaker
  speaking time, talk/listen ratio, longest monologue, and rep WPM from word
  timestamps. Pure arithmetic over the transcript, per `AGENTS.md` — no model
  sees it, so a persuasive rep cannot talk the numbers down.
- `src/engine/speech-metrics-agreement.ts` holds the pre-registered thresholds
  and returns the `scored` / `directional` verdict.
- `docs/research/h6-annotation-protocol.md` gives the annotator the same rules
  the engine implements, so the two are measuring the same quantity.

**Judgement calls were resolved in favour of reproducibility.** Fillers are
counted from a fixed list even where the word is doing real work in the
sentence ("So, what changed?" counts one), because judging intent is not
reproducible between annotators and the engine cannot do it either. If that
turns out to be the main source of disagreement, the finding is that the metric
needs an intent-aware rule — not that the tolerance should be widened.

**Still needed:** 20 recorded rep turns with diarised channels, and one
annotator working blind to the computed values. Recording consent is required
for any turn involving a real person.

Until the pass runs, the metrics are wired nowhere and score nothing.

---

## B) Component hypotheses

**H3. Deepgram Flux end-of-turn detection beats a fixed silence threshold.**

Claim: model-native turn detection cuts fewer rep sentences short than a silence
timer, at equal or lower dead air.

Vendor claim under test: end-of-turn within 1.5 s p95, interruptions reduced
~30%, latency reduced 200–600 ms versus traditional pipelines. Deepgram's own
number — this is the hypothesis, not the finding. Price $0.0065/min English.
- https://www.businesswire.com/news/%68ome/20251002758871/en/Deepgram-Launches-Flux---The-Worlds-First-Conversational-Speech-Recognition-Model

Method: record 30 rep turns containing natural mid-sentence pauses (thinking
pauses, filled hesitation, list enumeration) and 30 clean turns. Replay both
sets through Flux and through a fixed 700 ms silence VAD.

Measure: false-cut rate (prospect begins while the rep had more to say) and
dead air (ms from true end of rep speech to prospect audio start).

Threshold: adopt Flux if false-cut rate falls by more than 20% at equal or lower
dead air. If it does not, a silence threshold is free and Flux is not worth
$0.0065/min.

**H4. Kokoro is good enough, and voice choice does not change rep behaviour.**

Claim: ElevenLabs `eleven_v3_conversational` will win a blind preference test,
but the margin will not justify per-character cost for a training tool where the
rep already knows the prospect is synthetic — and the choice will not measurably
change how the rep sells.

Method, part 1 (preference): 10 prospect lines rendered by Kokoro (the existing
Unraid stack on :8880), `eleven_v3_conversational`, and one third option
(Cartesia Sonic 3 or Chatterbox). Blind forced-choice pairs: "which sounds more
like a real buyer on a call."

Method, part 2 (behaviour, the one that matters): identical drill, identical
persona, voice as the only variable. Compare final patience, facts unlocked,
blocked concession attempts, and grader score.

Threshold, part 1: ship Kokoro as the self-hosted default if its preference rate
against ElevenLabs exceeds 35%.

Threshold, part 2: if behaviour metrics are statistically indistinguishable
across voices, voice fidelity is not worth paying for and Kokoro becomes the
default outright.

Note on Kokoro: 82M parameters, Apache 2.0, CPU-capable, already running and
OpenAI-compatible on the Unraid stack, so it slots into the existing
`openai-compatible` provider shape at zero marginal cost.

---

## C) Product hypotheses

**H5. Voice drills produce measurably different rep behaviour than text drills.**

This is the hypothesis the whole build rests on. If it is false, voice adds
realism and no training signal.

Method: same seeded drill, same persona, same cohort. Half run the text call,
half run the voice call, then cross over on a second matched drill to control
for rep skill.

Measure, using existing engine output only — no new instrumentation needed:
final patience, call outcome, facts unlocked, blocked concession attempts,
grader score. Plus post-drill self-reported difficulty.

Prediction: voice yields lower final patience, fewer facts unlocked, and more
blocked concessions, because real-time pressure degrades performance relative to
composing text at leisure.

Threshold: if voice and text outcomes are statistically indistinguishable,
reconsider the investment before building further.

**H6. Speech metrics computed from STT word timestamps are accurate enough to
grade on.**

Claim: filler-word rate, talk/listen ratio, longest monologue, and WPM can be
derived from word-level timestamps closely enough to enter the score rather than
sit beside it as commentary.

Method: 20 recorded rep turns. A human annotator counts filler words, marks
talk/listen boundaries, and marks the longest monologue. Compare against values
computed from Flux word timestamps.

Threshold: filler-word count within +/-15% of the human count, talk/listen ratio
within +/-5 percentage points. Below either bar, the metric is reported to the
rep as directional only and is excluded from the score.

Decides: whether `src/engine/speech-metrics.ts` produces scored values or
informational ones. Per `AGENTS.md`, whichever it is, the computation stays in
engine code with tests.

---

## D) Established facts — not under test

These are settled enough to build against and are recorded so the hypotheses
above do not re-litigate them.

**D1. People cannot reliably detect cloned voices.** Participants correctly
identified a voice as AI-generated only ~60% of the time, and judged a clone's
identity to match the real person ~80% of the time. They could partly separate
fully synthetic voices from human ones, but not clones of real voices from the
real voices. Peer-reviewed, not vendor-authored — the strongest evidence in this
document.
- https://www.nature.com/articles/s41598-025-94170-3

**D2. ElevenLabs model lineup, August 2026.** `eleven_v3_conversational` ~280 ms,
70+ languages, WebSocket streaming. `eleven_flash_v2_5` ~75 ms, 32 languages,
40,000 character limit, number normalisation off by default. `eleven_v3`
expressive, 5,000 characters, not realtime. **v4 was previewed at ElevenSummit
in Warsaw and has not shipped — do not plan around it.**
- https://elevenlabs.io/docs/models

**D3. Cartesia Sonic 3 latency is contested.** 90 ms TTFA claimed by Cartesia;
~188 ms P50 with 100 ms IQR measured by Coval under its own conditions. Use the
independent figure.
- https://www.coval.ai/blog/best-speech-to-text-providers-in-2026-independent-benchmarks-and-how-to-choose/

**D4. Headline per-minute pricing understates real cost.** Reported all-in costs
run 2–3x advertised rates across platforms. Budget accordingly.

---

## E) What is needed to run these

Ordered by cost. H1 and H6 need no rep participants and should run first.

1. **H1** — Deepgram + ElevenLabs keys, one seeded drill with >= 5 locked facts,
   the fixed 5-question probe script. No reps.
2. **H6** — 20 recorded rep turns and one human annotator pass. No live reps.
3. **H3** — the 60-turn recording set from H6 extended, plus a replay harness.
4. **H2** — small harness with injectable delay; 4 short drills per rep.
5. **H4** — 10 rendered lines per engine, Kokoro reachable on Unraid :8880,
   plus a behaviour arm sharing H5's cohort.
6. **H5** — two matched seeded drills and a rep cohort large enough to cross
   over. The binding constraint on the whole plan.

Recording consent from participating reps is required before H2 onward.
