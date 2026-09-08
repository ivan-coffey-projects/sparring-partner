# H6 annotation protocol

Instructions for the human annotator pass in
[the voice channel test plan](voice-channel.md), hypothesis H6.

**Read this before listening to anything.** The comparison is only meaningful
if the annotator and the engine are measuring the same quantity. Where a
judgement call exists, the rule is written down here rather than left to the
listener, and the engine implements the same rule in
`src/engine/speech-metrics.ts`.

## What is needed

- **20 recorded rep turns.** Live-call audio with the rep and prospect on
  separate diarised channels. No rep participants are required — recordings
  from any prior session are fine, which is why H6 is one of the two
  hypotheses that can run early.
- **One annotator**, working without seeing the computed values. Seeing them
  first turns the exercise into agreement bias.
- **Recording consent** is required for any turn involving a real person.

## What to record per turn

| Field | How to count it |
| --- | --- |
| `turnId` | The recording's identifier, so a disagreement can be listened to again |
| `fillerCount` | Filler words spoken **by the rep only** — see the list below |
| `repTalkRatio` | Rep speaking seconds ÷ (rep + prospect speaking seconds), 0–1 |
| `longestMonologueSeconds` | Longest unbroken rep stretch — see the gap rule |

## The rules that decide edge cases

**Fillers are counted from a fixed list**, not by ear. The list is
`FILLER_WORDS` and `FILLER_PHRASES` in `src/engine/speech-metrics.ts`:
um, uh, erm, ah, like, basically, actually, literally, honestly, right, okay,
so — plus the phrases "you know", "I mean", "sort of", "kind of", "you see".

- A multi-word filler counts **once**, not once per word. "You know" is one.
- A filler word inside a filler phrase is **not** counted twice. "Kind of" is
  one filler; the "of" is not separately counted.
- Count the word whenever it appears in the list, even where it is doing real
  work in the sentence. "So, what changed?" counts a filler. This is a
  deliberate simplification: judging intent is not reproducible between
  annotators, and the engine cannot do it either. If this proves to be the
  main source of disagreement, that is a finding worth recording — it means
  the metric needs an intent-aware rule, not a wider tolerance.
- Punctuation and capitalisation are ignored.

**Talk ratio excludes silence.** It is talk/listen, not talk/elapsed. A call
that is half dead air still has a ratio near 0.5 if both sides spoke equally.

**A monologue survives a pause of up to 2 seconds** (`MONOLOGUE_GAP_SECONDS`).
Anything longer ends the stretch. Any prospect speech ends it too, however
brief — a rep talked over by "mm-hm" was not monologuing through it.

## Scoring the result

Feed each annotation and its computed counterpart to `scoreAgreement` in
`src/engine/speech-metrics-agreement.ts`. It applies the pre-registered
thresholds and returns `scored` or `directional`.

**The thresholds are fixed and must not be adjusted to make a run pass.**
Filler count within ±15%; talk ratio within ±5 percentage points. **Every**
turn must clear both bars — nineteen good turns do not carry a bad one, since
a metric that is wrong 5% of the time is not one to put in a rep's score.

A `directional` verdict is a result, not a failure. It means the metrics are
shown to the rep as commentary and excluded from scoring, which is exactly
what H6 was written to decide.

## What this does not settle

H6 tests whether the metrics are *accurate*. It says nothing about whether
they are *predictive* of rep performance — a separate question, and one no
hypothesis in the current plan addresses.
