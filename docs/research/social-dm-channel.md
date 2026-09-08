# Social DM channels — research base

Evidence reviewed 2026-08-19. This document provides per-platform evidence
for the simulated DM prospect and rep rubrics. Tags: [measured] survey/dataset with stated method;
[platform-official] the platform's own feature/policy/data; [vendor] real but
self-interested; [anecdotal] practitioner consensus, unverified.

**Global caveat for the engine:** almost every sales-side conversion number
comes from automation vendors incentivized to show outreach "works" — treat
real buyer reply rates as the LOW end of every quoted range. The only
genuinely platform-measured message-level datasets: LinkedIn's InMail
length/latency corpus (2022), Belkins/Expandi 15–20M-touchpoint LinkedIn
studies (2024–25 data), Sprout Social Index consumer surveys, Pew
demographics, Meta earnings/policy documents. Buyer-register norms are
consistently documented but never formally measured — implement as strong
priors with tunable constants.

---

## 1. Instagram

### A) Prospect simulation parameters

**A1. Inbox gate — cold outreach mostly dies unseen.** Messages from
non-followed accounts land in Requests: no notification prominence, no read
receipt until accepted, sender limited to ONE text-only message until
accepted [platform-official; requests revamp Nov 2024 — techcrunch.com].
Practitioners estimate ~80% of request-folder messages are never read
[anecdotal]. → Cold: p(seen) ≈ 0.2–0.4, one message max. A **warm** scenario
(story reply, comment trigger, follower) bypasses the gate — this is the
realistic training scenario.

**A2. Reply probability by warmth** [vendor/anecdotal, consistent]: cold
generic 3–7%; cold personalized 10–25%; warm (engaged with content / story
reply) 30–50%. ManyChat comment-trigger case studies claim 85%
commenter→email conversion [vendor, self-reported].

**A3. Latency.** 73% of consumers expect brand response within 24h, ~40%
within 1h [measured — Sprout Social Index 2025, n≈4,000]. Warm prospects
reply minutes-to-hours in active sessions; multi-hour/1-day gaps between
sessions [anecdotal].

**A4. Register.** Casual, lowercase-tolerant, emoji-flecked, MULTIPLE SHORT
messages not paragraphs; DM cap 1,000 chars; first ~7 words show in preview.
Voice notes native mid-conversation (warm only — non-followers can't send
them pre-acceptance [platform-official]). → Prospect: 1–15 words typical,
bursts of 1–3 messages, high emoji, zero formal salutations.

**A5. Ghost triggers.** (a) **Ghost-after-quote** — "how much?" early → price
lands bare → silence; the single most documented IG drop-off [anecdotal,
highly consistent]. (b) Pitch before feeling understood. (c) Wall-of-text
reply. (d) Call pushed too early on low-ticket. Read receipts
user-disableable since Jan 2024 — leaving-on-seen is ambiguous by design
[platform-official]. → After a bare price quote: p(ghost) ≈ 0.4–0.6 unless
the rep first asked a qualifying question and mirrored the stated need.

**A6. Spam pattern-match → block.** The MLM "hey hun" script is meme-level
recognizable: manufactured intimacy ("hun"/"babe"/"girl"), surveillance
flattery ("been following you for a while"), copy-paste compliments ("love
your vibe" with nothing profile-specific), instant pitch or link in message
1, follow-unfollow, canned-reply automation tells [The Atlantic Jan 2021;
dehek.com Feb 2026]. Urgency deadlines, off-platform payment pushes,
too-good prices kill the thread [abc.net.au Sep 2023]. → spam_score
increments; threshold → "who is this?" / "is this legit?" or silent block.

**A7. Positive triggers.** Specific reference to the prospect's
profile/content; question-first opener ("are you looking for A or B?");
permission-based pitch ("want me to share how I'd approach it?"); one
qualifying question before a booking link; social proof when trust is
questioned [practitioner — FlowChat "Sell by Chat", setter culture].
Price question comes early regardless — HOW the rep handles it (context +
question vs bare number) gates the ghost probability.

**A8. Close mechanics 2025–26.** Instagram native checkout was discontinued (phased
out Jun–Aug 2025) [measured/news]. Closes: website checkout link, booking
link after a qualifying question, or migration to WhatsApp. High-ticket:
8–15 messages over 2–7 days before booking [anecdotal, tunable]; mid-ticket
3–8 messages over 1–3 days.

**A9. Objection set.** Price ("how much?"/"HM?"), trust/"is this a scam",
"just looking", "who are you?", show-me-reviews/real-photos, phone-call as
trust escalation.

### B) Rep rubric (Instagram)
1. No pitch/link in message 1 (hard fail to a cold prospect).
2. Swap test / specificity — opener references something only THIS prospect
   has (lead-scorer.com rubric: personalization 30/100, swap test 20/100).
3. Question-before-pitch — qualify before any offer.
4. Length/register match — short lines, casual; penalize paragraphs and
   formal salutations.
5. Price handling — price WITH context/anchor + follow-up question, never a
   bare number as thread-ender.
6. Spam-pattern avoidance — "hey hun/dear", copy-paste compliments, urgency,
   hype emoji.
7. Trust response — when challenged, offer proof; never pressure.
8. Close-path correctness — website/booking link or WhatsApp hop; never
   defunct native checkout or off-platform payment pressure.
9. Response speed to inbound — minutes–1h scores high.

---

## 2. LinkedIn

### A) Prospect simulation parameters

**A1. Connection-accept model** [measured-vendor — Belkins/Expandi, 20M+
requests 2024 data, 15.1M 2025 data]: acceptance ~25–28% with or without a
note — **notes don't change acceptance**; but post-accept reply 9.36% with
note vs 5.44% without (**+72%**; 2025 edition +55%). AI-written vs human
note: 7.3% vs 7.0% reply (no material difference). Waalaxy [vendor, no methodology]: links in
the note = biggest acceptance penalty. Seniority: VP+ accept ~22% vs ICs
~41% [vendor]. → p(accept) ≈ 0.25–0.35 base; note quality drives
*downstream* reply ~1.5–1.7x; link/sales language in note −0.06..−0.10;
VP personas accept ~half as often.

**A2. Reply probability.** Cold DM baseline 3.7–10.3%; overall sequence
reply 7.2% (Belkins 2025); 1st-degree messages ~12–17%; multi-touch 15–25%
cumulative with **40–60% of replies from messages 2–4**; meeting booked from
connected: 1.3% [measured-vendor]. Ignore the vendor-marketed "18–25% InMail
average" — inflated/recruiting-tinged.

**A3. Message-feature modifiers** [platform-official — LinkedIn's own InMail
corpus, the ONLY platform-measured message-level data]: **<400 chars +22%**
vs average; 400–800 +5%; 800–1,200 −6%; >1,200 −11%; individually-sent +15%
vs bulk; Friday −4%, Saturday −8%. Content-reference: 11.4% vs 3.7% baseline
[vendor]; pre-DM engagement +39% [vendor]; voice-note "2x" traces only to
LaGrowthMachine's own funnel on warmed 1st-degree connections [vendor —
cap the bonus].

**A4. Latency — the sharpest contrast vs IG/WhatsApp.** ~1M B2B conversation
dataset [measured-vendor — emailsearch.io]: median reply ≈ 22h weekdays.
LinkedIn official: 65% of InMail responses within 24h, 90% within a week. →
Lognormal, median ~22h, tail to 7 days, limited weekend activity; never minutes-fast
except inside an actively-open chat session.

**A5. Register & limits.** "Business casual": no "Dear", no signature
blocks, prospect replies 1–3 sentences; long seller paragraphs read as
templates. Limits [platform-official]: connection note 300 chars; InMail
subject 200 / body ~1,900; 1st-degree message ~8,000; free accounts ~5
personalized invite notes/month (since late 2023).

**A6. Immediate pitch after connection.** Connect-then-immediately-pitch →
dominant response silence; then curt brush-off,
connection withdrawal, block/report, occasionally public screenshot-shaming
[anecdotal, highly consistent — trykondo.com upd. Mar 2026; practitioner
estimate: "~1%" reply]. A hard calendar ask in the opener has the same effect.
→ pitch within first 1–2 messages post-accept: p(reply) ≤ 0.02,
p(withdraw) 0.1–0.3, persistent reputation penalty.

**A7. Recipient-research requirement** [measured — LinkedIn State of Sales 2022, ~15k
respondents]: **79% of buyers won't engage a seller who doesn't know their
company; 93% more likely to engage with personalized communication; the #1
deal-killer class is misleading/wrong information** (4 of top-5
deal-killers are information failures). LinkedIn–Ipsos 2025: 86% say seller
expertise drives trust; only 45% find sellers trustworthy. Peer-reviewed
buyer-side (Ancillai et al., JBIM 2024, n=26): buyers bombarded with
generic requests ignore/delete; they lurk; they willingly move to
email/phone when contact is thoughtful. → Any factual error about the
prospect's company = severe trust penalty; evidence-of-research is the main
trust builder.

**A8. Off-platform move.** p(agree to call) ≈ 0 on message 1; rises after
the prospect has asked a question or shared a pain; interest-CTA ("worth a
look?") ~2x vs hard calendar ask [practitioner — 30MPC; consistent with the
Gong email CTA data].

**A9. Scenario realism.** Invite cap ~100/week; SSI is soft-deprecated —
LinkedIn's own page concedes high SSI "doesn't always correlate with
measurable sales outcomes" (2025) — do not build scoring on SSI.

### B) Rep rubric (LinkedIn)
1. No immediate pitch — no offer or calendar request in the first 1–2 messages after acceptance.
2. Length discipline — <400 chars optimal; penalize >800 [measured].
3. Personalization/swap test — accurate reference to company/role/content.
4. Factual accuracy about the prospect — any wrong claim = severe deduction
   (the measured #1 deal-killer).
5. No link in the connection note.
6. Warm-up credit — pre-DM engagement before the invite.
7. CTA style — interest-based > meeting ask; one CTA only.
8. Sequence discipline — follow-ups 2–4 spaced days apart; stop by touch
   5–6; no bump-spam.
9. Register — business-casual; penalize "Dear Sir", signature blocks,
   jargon walls.
10. Latency patience — following up within hours of silence = penalty
    (buyer median reply is ~22h).

---

## 3. Facebook Messenger / WhatsApp (banked for a future channel)

Structurally different: cold outreach is near-impossible (WhatsApp requires
opt-in [platform-official policy verbatim]; Messenger non-connections land in
Requests). Realistic scenarios are **buyer-initiated inbound** (click-to-
message ad, catalog inquiry) and the core mechanic is SPEED: 42% expect a
business reply within 15 min, 66–70% within 1h [measured — EZ Texting];
"immediate" = ≤10 min [measured — Zendesk CX Trends 2025, n=10,000]; ~73%
buy from a competitor if no response [Sprout]; Meta "Very Responsive" badge
= <15 min median [platform-official]. Register: 1–8 word bursts, informal,
regional idiom; ghost-after-quote ≈ 0.3–0.5; bot-detection probes ("are you
a bot?") with human-escalation demands (79–85% prefer human across 3
independent surveys); 24-hour customer-service window constrains free-form
replies [platform-official]; closes = payment link / COD / booking
in-thread; trust rituals (proof photos, reviews, COD, "legit ba?") for
local-commerce personas. Rubric axes: speed, answer-the-question-first,
brevity, quote technique, follow-up discipline within window, trust
handling, human-ness, policy compliance, close mechanics.

## 4. X/Twitter (brief)
Cold DMs from unverified accounts are silently dropped for most inboxes
(default DM setting since Jul 2023); the "ignored opener" is a platform
mechanic. Engage publicly before DM; register terse/irreverent. Not a v1
channel.

## 5. Cross-platform contrast (engine defaults)

| Axis | Instagram | LinkedIn | Messenger/WhatsApp |
|---|---|---|---|
| Realistic initiator | Warm inbound (story reply/comment) | Rep via invite + sequence | Buyer via ad/catalog |
| Prospect latency | Minutes–hours, session-based | Median ~22h, limited weekend activity | Minutes; expects same of rep |
| Register | Casual, emoji, lowercase bursts | Business-casual, 1–3 sentences | Very short bursts, regional idiom |
| Length ceiling | ~2–3 short lines | <400 chars optimal [measured] | 1–2 short lines |
| Pitch tolerance msg 1 | Near-zero (MLM pattern-match) | Near-zero (immediate pitch) | N/A — buyer asked first; deflection is the primary failure mode |
| Signature ghost trigger | Price → seen → silence | Immediate pitch → silence/withdrawal | Quote → blue-tick → competitor |
| Off-platform destination | WhatsApp; booking link | Email/phone/Zoom | Primary conversation channel |

Pew 2025 (n=5,022): IG 18–29 80% use; LinkedIn 25% of adults, professional
skew; FB 71% peak 30–49. (Pew's 2025 X=8% figure looks anomalous — verify
before hardcoding.)

## 6. Trainer/tool landscape
LinkedIn State of Sales 2022 + LinkedIn–Ipsos Deep Sales 2023 ("deep
sellers" ~2x quota attainment, only 18% qualify) [measured,
vendor-sponsored]. Vengreso PVC (Personalize, Value, CTA) — clean 3-axis
skeleton, zero published outcomes. Setter/closer economy scripts (FlowChat,
Taki Moore, Dan Martell): permission opener → triage question → SGTCB
qualify → permission bridge → booking link — prospects are SATURATED with
these; the simulated prospect should recognize and punish them when executed
generically [documented + FTC Jun 2024 alert + abc.net.au May 2026
investigation]. Borrowable rubrics: lead-scorer.com 100-pt QA (grounded
personalization 30, swap test 20, single ask 15, length/rhythm 15 — <600
chars LinkedIn, honesty 10, voice 10); connectsafely.ai 6-metric analyzer.
Academic anchors: Terho et al. 2022 (IMM, n=201 — effects run through
relationship behaviors, not volume); Ancillai et al. 2024 (JBIM). No
academic support exists for any specific script, cadence, or exchange-count
threshold.

## 7. Known evidence gaps (tunable constants, not facts)
1. No measured data on exchanges-before-call-ask — all cadence numbers are
   vendor folklore.
2. No neutral prospect reply-latency corpus except LinkedIn.
3. Every DM "close rate" claim (15–30% setter, 12–18% WhatsApp-vs-IG) is
   unverifiable marketing.
4. IG story-reply benchmarks are untraceable SEO folklore — direction fine,
   numbers arbitrary.
5. The 98% WhatsApp / 80–90% Messenger open rates are 2017–18 folklore.
6. Several low-quality aggregation sites cite fabricated Instagram studies;
   do not cite creatorflow.so, communipass, leadresponse.co,
   flowgent.ai, jawab24.

## Sources (highest-weight)
- linkedin.com/business/talent/blog — InMail corpus (May 2022): the only
  platform-measured message-length data.
- belkins.io/blog/linkedin-outreach-study — 20M+ (2024) and 15.1M (2025)
  touchpoints; methodology stated.
- business.linkedin.com State of Sales 2022 (~15k respondents) — buyer
  deal-killer data; the recipient-research requirement.
- ipsos.com — Deep Sales 2023 + Trust Advantage 2025.
- pewresearch.org social media fact sheet 2025 (n=5,022).
- sproutsocial.com/insights/index/ (Sep 2024, n≈4,000).
- zendesk.com CX Trends 2025 (n=10,000).
- whatsappbusiness.com/policy — primary policy text.
- fool.com Meta Q4 2025 earnings transcript.
- emerald.com — Ancillai et al. JBIM 2024 (peer-reviewed buyer-side).
- sciencedirect.com — Terho et al. 2022 IMM.
- theatlantic.com (Jan 2021 MLM backlash); abc.net.au (Sep 2023, May 2026).
- Vendor (flagged): waalaxy.com, reactin.io, evaboot.com, emailsearch.io,
  lagrowthmachine.com, trykondo.com, 30mpc.com, hypeauditor.com/manychat,
  flowchat.com, lead-scorer.com, connectsafely.ai.
