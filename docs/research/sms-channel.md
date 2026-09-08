# SMS channel — research base

Evidence reviewed 2026-08-19. This document supports the simulated SMS
prospect's code-enforced behavior, the rep scoring rubric, and the compliance checks.
This file is the source the seeded "SMS Playbook" methodology entries and
`src/engine/channels.ts` SMS parameters cite.

**Provenance warning (read first):** the most-quoted numbers in this space
("98% open rate", "45% SMS vs 6% email response", "90-second average reply")
are recycled vendor lore — directionally sound (every independent dataset
confirms SMS ≫ email) but treat exact values as folklore. Best *measured*
datasets: **Verse.ai's 10M+ SMS-conversation telemetry** (2024–2026), **TextUs
platform data**, **SimpleTexting Dec-2024 survey** (n=1,000 consumers + 400
businesses), **EZ Texting Nov-2024 survey** (n=1,074), and **Velocify's
lead-conversion study** (~2014 — old, still the only sequencing study).

---

## A) Prospect simulation parameters

**A1. Read ≈ always; reply is the scarce resource.** Open rates 90–98%; 83%
read texts within 30 min; 82% check within 5 min. Model reply probability,
not read probability. (Text Request 2025 State of Business Texting;
SimpleTexting Dec-2024 survey.)
- https://www.textrequest.com/ebooks/state-of-business-texting-report-2025
- https://simpletexting.com/blog/2025-texting-and-sms-marketing-statistics/

**A2. Baseline reply probability by relationship state.**
- Warm/opted-in lead, well-formed message: p(reply) ≈ 0.45–0.50 per message
  (Verse 10M-conversation avg 50%; industry avg ~45%; <30% poor, 30–50%
  solid, >50% excellent).
- Cold outbound blast: p(reply) ≈ 0.11 within 24h (Textedly).
- Ghosted-then-re-engaged ("win-back"): p(reply) ≈ 0.15.
- Automotive-sales persona: 0.20–0.30 (TextUs vertical benchmark).
- https://verse.ai/blog/sms-response-rates-what-the-data-really-shows/ (Mar 2026);
  https://www.textedly.com/blog/sms-response-rate ;
  https://textus.com/sms-benchmarks/sms-benchmarks-for-automotive-sales-and-service

**A3. Pitch-first / cold-first-text → below baseline + high ghost odds.**
Texting *before* any prior phone/email contact converts ~5% BELOW average
(vs **+112.6% ABOVE average when the text follows a phone conversation**) —
the largest sequencing effect in the literature (Velocify, ~2014, dated but
unreplaced). HubSpot rep guidance: "never cold text without a prior
conversation." ZoomInfo poll: only ~1/3 called cold texting effective. →
First message that pitches without identification/context/prior contact:
p(reply) × ~0.2, elevated p(opt-out/report).
- https://www.marketingprofs.com/articles/2016/29419/ ;
  https://blog.hubspot.com/sales/text-sales-prospects (upd. May 2025);
  https://pipeline.zoominfo.com/sales/cold-texting-prospects (upd. Jul 2026)

**A4. Length penalty gradient.** Reply rate by chars (industry gradient,
provenance unclear — use as multiplier *shape*): 50–99 chars = 68%, 100–199 =
53%, 200–299 = 44%, 500+ = 31% → multipliers ≤99 ×1.0, 100–199 ×0.78,
200–299 ×0.65, ≥500 ×0.46. Corroboration: TextUs — under 100 chars = 2–5x
response; Verse keeps new-lead texts 30–39 chars; Salesmsg: "if it can't fit
in two short sentences, it belongs in an email." → >320 chars (multi-segment
wall of text) = short/cold reply or none; prospect may answer only the last
question or reply "who is this?".
- https://www.textedly.com/blog/sms-response-rate ;
  https://textus.com/blog/ideal-length-of-text-messages (Mar 2024);
  https://verse.ai/blog/7-sales-text-message-examples (Sep 2024);
  https://www.salesmessage.com/blog/sms-marketing-best-practices

**A5. Question mechanics dominate reply probability.** Verse campaign data:
direct qualifying questions get 74–92% reply from engaged leads (price 74%,
pre-approval 88%, employer history 92%); "Can I send you info on X?" = 75%.
Direct yes/no beats open-ended over SMS. "Just checking in" is a measured
reply-killer. Softeners help ("Still interested by chance?"). → Engaged
prospect + one specific low-friction question → p(reply) 0.7–0.9; no
question/CTA → × ~0.5; "checking in" with no new value → × ~0.3.
- https://verse.ai/blog/7-sales-text-message-examples

**A6. Two-part opener bonus.** Opening with two messages (ID/compliance line,
then a human line) got **+44% responses** (Verse). ≥3 rapid-fire messages tips
into annoyance (A8).

**A7. Reply latency.** When they reply, it's fast: 32% check within 60s, 82%
within 5 min. Engaged prospects: 1–15 min during business hours. Replies
concentrate 9am–4pm, peak 9–11am; outside that window → next morning or not
at all. Qualification realism: average lead takes **~14 texts over ~4.5h** to
qualify (Verse) — a full sim conversation runs 10–15 turns, not 3.

**A8. Over-messaging decay and opt-out triggers.** "Texting too often" is the
#1 opt-out reason — 53% (SimpleTexting survey); frequency top trigger at 40%
(EZ Texting 2026); only 6–10% tolerate 2+/week; ~48–49% want every-other-week.
Follow Up Boss rule: never text several consecutive days — flags carrier spam.
→ Consecutive-unanswered counter: after 2 unanswered, p(reply) halves per
additional attempt; 3+ messages in 24h → annoyance state (curt reply, "please
stop texting me", or silence); >5 total unanswered → permanent ghost or STOP.
- https://www.eztexting.com/report/2025-consumer-texting-report ;
  https://www.followupboss.com/blog/texting-real-estate-leads

**A9. Spacing reward.** 48h–3 days between follow-ups holds reply probability
near baseline (Textline: 2–3 days apart, cap 3–5 follow-ups; ZoomInfo: wait
48h, one follow-up, then switch channels). → Follow-up ≥48h later with new
value = no decay; follow-up <24h into silence = decay applies.
- https://www.textline.com/blog/sales-follow-up-text-message-templates-to-engage-prospects (Jan 2025)

**A10. Speed-to-lead (inbound scenarios).** Prospect warmth decays with rep
response latency — contact within 5 min ≈ **21x** more likely to qualify than
at 30 min (InsideSales/Oldroyd 2007 — old, never overturned); dealership BDC
standard <5 min. → Warmth ×1.0 at <5 min → ~×0.3 by 1h → near-cold at 24h.
- https://verse.ai/blog/speed-to-lead-statistics ; https://www.podium.com/article/speed-to-lead

**A11. Time-of-day and persona formality.** Outside 8am–9pm recipient-local →
annoyance + compliance flag. Best windows 10am–12pm Tue–Thu (Salesmsg
telemetry). Emoji: persona-dependent — only 15% of 45+ consumers like emoji in
business texts (30% call it too informal); older/B2B persona penalizes
emoji/slang; all personas penalize 3+ emojis; stiff email formatting
(salutation, signature block) reads as automated → small penalty.
- https://help.salesmessage.com/en/articles/6868622 ; https://www.avochato.com/blog/54-text-messaging-stats-every-business-should-know-avochato

**A12. Opt-out and soft-no handling.** After STOP or explicit "not
interested": any further message → hostile reply + hard fail (legal exposure
$500–$1,500/text). Soft signals ("slammed right now") pushed → ghost.
Guilt-tripping ("you never answered my email") → ghost/annoyance (HubSpot
"unacceptable" list).

**A13. Re-engagement realism.** Ghosted prospect texted weeks later with a
concrete "why-now" trigger: p(reply) ≈ 0.15; generic "bumping this" near
zero. Gong 2024: 45% of silent deals are lost forever — some ghosts should be
unrecoverable regardless of skill.

**A14. B2B persona modifier.** B2B texting acceptable only *after*
permission/prior contact, business hours only; stronger pitch-first and
after-hours penalties; expects channel discipline (complex content → "can you
email that over?").
- https://www.thequota.co/articles/texting-prospects-when-where-how (Sep 2024)

---

## B) Rep scoring rubric

1. **Earned the channel** — texted only after prior contact or explicit
   permission. (Velocify +112.6% after phone vs −5% text-first; HubSpot.)
2. **Speed to lead** — inbound interest answered <5 min full credit, <30 min
   partial. (21x at 5 min; BDC standard.)
3. **First-text structure** — name + company + context/how they got the
   number + one low-friction ask; ≤160 chars, ≤3 sentences. (ZoomInfo REACH;
   Textline template.)
4. **Brevity per message** — full marks ≤100 chars, acceptable ≤160, penalty
   ≥320, fail for email-pasted walls. (TextUs 2–5x; 68→31% gradient.)
5. **One clear question/CTA per message** — direct yes/no or specific
   qualifying question; call asks offer two concrete slots. (Verse 74–92%.)
6. **Value-per-touch** — every follow-up adds something new; never bare "just
   following up." (Follow Up Boss; HubSpot.)
7. **Cadence discipline** — ≥48h between unanswered follow-ups; ≤3–5 total;
   switches channel rather than repeat-texting; no consecutive-day texting
   into silence. (Textline; ZoomInfo; Follow Up Boss.)
8. **Tone calibration** — professional-friendly, mirrors prospect register
   (emoji only if prospect uses them first), no slang/all-caps, no formal
   email formatting. (thequota.co; Verse; HubSpot.)
9. **Timing** — inside 8am–9pm recipient-local (hard); bonus 10am–12pm
   Tue–Thu. (Salesmsg KPI telemetry.)
10. **Channel judgment** — complex/pricing/negotiation → call or email; text
    for scheduling, confirmations, quick questions. (HubSpot; thequota.co.)
11. **Respects no** — stops instantly on STOP/"not interested"; acknowledges
    soft-nos with a future touchpoint instead of pushing.
12. **Personalization** — references their inquiry/industry/prior
    conversation, not template-generic. (Salesmsg.)
13. **Responsiveness once engaged** — replies within minutes during business
    hours (57% of consumers expect a business reply within 15 min; 74% within
    1h — EZ Texting).

---

## C) Compliance checklist (rep-level grader flags)

1. **No consent, no marketing text** — promotional texts require prior express
   *written* consent; cold-texting a bought list = automatic fail.
   (activeprospect.com TCPA guides; callhub.io 10DLC guide.)
2. **1:1-consent note** — FCC's one-to-one consent rule vacated (Eleventh
   Circuit, Jan 2025); base consent rules fully apply. (Goodwin CFS 2025 YIR.)
3. **Quiet hours** — no sales texts before 8am or after 9pm *recipient's*
   local time (federal baseline); FL/OK-style states cut off at 8pm;
   quiet-hours texts are an active 2025 class-action theory even with consent.
4. **Frequency cap** — FTSA-style states: max 3 contact attempts per 24h on
   the same subject. Flag ≥3 texts in 24h.
5. **Honor any revocation, any wording** — since Apr 11 2025, opt-out via ANY
   reasonable means must be honored ("stop texting me", "leave me alone");
   one final confirmation message permitted; anything after = violation.
6. **Identify yourself** — name + business in the first message; first
   outreach includes opt-out language ("Reply STOP to opt out").
7. **Registered number only** — business traffic on registered 10DLC/short
   code; texting from a personal cell is flaggable (carriers block
   unregistered 10DLC since Feb 2025).
8. **No consent laundering** — consent to be texted about X is not consent
   for Y (FTSA "same subject matter").

---

## D) Source table

| Source | Date | Credibility |
|---|---|---|
| verse.ai — response rates | Mar 2026 | Vendor, real telemetry: 10M+ conversations; best reply/latency/qualification numbers |
| verse.ai — 7 examples | Sep 2024 | Vendor, measured campaign reply rates (74–92%, +44% double-text) |
| simpletexting.com — 2025 stats | Dec 2024 | Real survey n=1,400; opt-out reasons, check speed |
| eztexting.com — 2025 consumer report | Nov 2024 | Real survey n=1,074; response-time expectations |
| textrequest.com — 2025 report | Jan 2025 | Survey n>500; 83% read <30 min |
| textus.com — ideal length / auto benchmarks | 2024–25 | Vendor platform data; methodology thin |
| marketingprofs/velocify — sequencing study | ~2014 | OLD but unreplaced; direction solid, magnitude dated |
| blog.hubspot.com — text sales prospects | upd. May 2025 | Editorial consensus rep guidance |
| pipeline.zoominfo.com — cold texting | upd. Jul 2026 | Vendor editorial, honest about downsides; REACH framework |
| textline.com — follow-up templates | Jan 2025 | Vendor training; cadence rules |
| salesmessage.com + help.salesmessage.com | 2024–25 | Trainer content + telemetry (10am–12pm fastest) |
| followupboss.com — texting leads | ongoing | Real-estate CRM trainer; frequency caps |
| BDC guides (proactivetrainingsolutions, useflai, strolid) | 2025–26 | Dealership consensus: <5-min contact, 72h cadence |
| verse.ai + podium.com — speed to lead | 2024–25 | 21x/78% trace to 2007 InsideSales study — dated, recycled |
| goodwinlaw.com CFS 2025 YIR | Mar 2026 | Law firm — high credibility on vacatur + revocation |
| privacyworld.blog / fedsoc.org / activeprospect.com | 2025–26 | Legal-adjacent; quiet hours, consent tiers |
| optinfix.com / enzodialer.com | 2026 | Compliance vendors; state mini-TCPA rules |
| callhub.io — 10DLC 2025 | 2025 | Compliance vendor; registration, STOP/HELP |
| textedly.com — response rate | 2025 | Vendor roundup; length gradient + 11% outbound — provenance unclear, shape only |
| avochato.com — 54 stats | ~2023 | Weak provenance ("15% of 45+ like emoji") — directional |

Gaps: Reddit practitioner threads unreachable during the pass (proxied via
thequota.co/HubSpot/trainer content); length-gradient and 90-second figures
lack traceable primary studies (safe as relative multipliers, unsafe as
user-facing quoted facts); FCC decision pending on quiet hours for consented
messages — recheck before shipping compliance copy; no clean B2B-specific SMS
reply telemetry exists (B2B modifier rests on qualitative guidance).
