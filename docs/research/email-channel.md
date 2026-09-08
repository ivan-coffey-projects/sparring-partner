# Email channel — research base

Evidence reviewed 2026-08-19. This document supports (A) the simulated email
prospect's code-enforced behavior and (B) the rep scoring rubric. Effect sizes are tagged
with who measured them; vendor-marketing claims are flagged. This file is the
source the seeded "Email Outreach Playbook" methodology entries and
`src/engine/channels.ts` email parameters cite.

**Population caveat that shapes the engine:** the big datasets disagree because
they measure different populations. Lavender/Gong/Instantly/Belkins = B2B sales
email (primary). Backlinko/Pitchbox 12M (2019) = link-building/PR outreach
(older, different genre — used only where it's the sole source).

---

## A) Prospect simulation parameters

### A1. Base reply probability (per prospect, per sequence)
- **Baseline total reply rate: 3.4%** across billions of sends, Jan–Dec 2025
  (Instantly Benchmark Report 2026, https://instantly.ai/cold-email-benchmark-report-2026).
  Belkins' 16.5M-email agency dataset runs ~5.8% avg (down from 6.8% in 2023) —
  agency campaigns are pre-optimized (https://belkins.io/blog/cold-email-response-rates).
  Top quartile 5.5%+, top decile 10.7%+ (Instantly).
- **Only 40–60% of replies are positive/interested**; the rest are objections,
  "not interested," wrong-person, unsubscribe demands
  (https://instantly.ai/blog/cold-email-reply-rate-benchmarks/). → Sample reply
  valence separately from reply occurrence.
- **Quality multipliers (multiplicative on baseline):**
  - Advanced/relevant personalization: ~17–18% reply vs 7–9% basic — roughly
    **2x** (Woodpecker 20M+ emails, https://woodpecker.co/blog/cold-email-statistics/).
    Backlinko: personalized subject +30.5%, body +32.7% (12M, 2019,
    https://backlinko.com/email-outreach-study).
  - Lavender "A-grade" email (short, low reading level, prospect-focused, 1 CTA):
    3.4%→4.3% = **+27%** across 231,818 cold emails; up to +58–79% for
    ops/finance personas (Lavender Benchmark Report, updated Feb 2026,
    https://lavender.ai/blog/the-cold-email-benchmark-report).
  - Blast-scale penalty: campaigns <50 recipients avg **5.8%** vs 500+
    recipients **2.1%** (Belkins/Woodpecker). → Generic-template detection
    should cut reply probability ~2.5x.
- **Persona modifier: C-level is 30.2% less likely to reply** than non-execs
  (Gong, 1M+ executive sales cycles,
  https://www.gong.io/blog/do-execs-really-reply-to-cold-email-here-s-what-the-data-says).

### A2. Skim model (how the prospect "reads")
- **Average attention per email: 9 seconds** (Litmus 2022); 30% of emails get
  <2s, 41% get 2–8s, only 29% get >8s
  (https://www.marketingprofs.com/charts/2023/48537/how-much-time-do-people-typically-spend-looking-at-an-email).
  Execs: <3s open decision, ≤9s read (Gong, above).
- **64% of B2B buyers decide open/no-open on subject line alone**
  (Sopro-cited, https://sopro.io/resources/blog/b2b-buyer-statistics-and-insights/).
- **~81% of email opens on mobile** (Lavender claim; conservative floor >50%);
  ~33 chars of subject visible in mobile preview
  (https://lavender.ai/blog/mobile-matters). → Prospect "sees" only subject +
  first ~2 lines before deciding to read; walls of text on mobile ≈ unread.
- Implementable rule: prospect processes subject → first sentence → CTA, in
  that order; if any gate fails (irrelevant subject, self-focused opener,
  heavy ask), reply probability collapses even if the body is good.

### A3. Reply latency
- **If a prospect will reply, it happens fast: 90% of replies land within 1 day
  of open; >50% within 3 hours** (Yesware tracked-email dataset,
  https://www.yesware.com/blog/sales-follow-up-statistics/). → Median ~2–4
  business hours, 90th percentile ~24h, thin tail to ~3 days. No reply within
  3–4 days ≈ effectively dark for that step.

### A4. Going dark and follow-up response model
- Reply mass by step: **first email 58% of all replies, follow-ups 42%**
  (Instantly 2026; Woodpecker corroborates). Belkins' agency data inverts this
  (steps 2–6 = 58.6% of replies; step 3 books more meetings than steps 1–2
  combined) — agency-grade targeting; keep both as difficulty presets
  (https://belkins.io/blog/sales-follow-up-statistics).
- **Follow-up 1: +49% to +65.8% reply lift** (Belkins; Backlinko/Pitchbox).
  **Follow-up 2 adds only ~3.2pp more, ~45% less than FU1**; returns keep
  decaying (aggregation, https://martal.ca/b2b-cold-email-statistics-lb/).
- **Optimal sequence 4–7 touches; beyond 7 = diminishing returns; >4
  follow-ups triples spam-complaint/unsubscribe risk** (Instantly 2026;
  Woodpecker). Belkins recommends 3–5 steps.
- Cadence with data behind it: Day 1 / 4 / 8 / 15; a 0-3-10-17 cadence captures
  **93% of total replies by day 10** (martal.ca, secondary). → Escalating
  annoyance: same-day double-tap or daily bumps spike dark-forever/complaint
  probability.
- **Breakup email: measurable resurrection.** Final breakup step generated
  **14% response across 156K sequences** (GrowLeads, vendor blog — medium
  credibility, https://growleads.io/blog/breakup-email-templates-outbound-email-outreach/);
  HubSpot anecdotally 33%. 30–40% of breakup replies advance to a call. → A
  well-crafted breakup gets a distinct reply-probability bump, mostly
  "closure" replies (referral, "bad timing, try Q3," honest no).
- Context: 48% of real reps never follow up; 44% quit after one follow-up
  (Woodpecker).

### A5. Forwarding / buying-committee behavior
- **Gartner: B2B buying group = 6–10 stakeholders**
  (https://www.gartner.com/en/sales/insights/b2b-buying-journey). Forrester
  State of Business Buying 2024: avg 13 stakeholders, 89% cross-department
  (via https://www.thestarrconspiracy.com/insights/benchmarks/b2b-buying-committee-benchmarks-2025).
- **Emailing 1–2 contacts per company: 7.8% reply vs 3.8% when blasting 10+ at
  the same org** (Belkins-derived, https://prospeo.io/s/b2b-cold-email-reply-rates).
- **Wrong-person emails commonly produce referrals, not silence** — when the
  ask is low-friction (practitioner consensus, Bravado threads).
- Engine rules: high relevance + non-owner persona → "forwarding you to X"
  replies; "are you the right person?" with an easy out raises referral
  probability; 70–80% of the journey happens off-thread (Gartner) — prospect
  may return days later better-informed.

### A6. Objection patterns / reply valence
- Common non-positive classes: "not interested" (reflex), "wrong person,"
  "bad timing / circle back in Qx," "we already use [competitor]," "send me
  more info" (semi-positive deflection), unsubscribe/complaint. "Not
  interested" over email is usually a ten-second reflex, not a considered no
  (https://www.mapsleads.co/blog/how-to-handle-not-interested).
- A good rep response to an emailed objection (short, curious, non-pushy,
  <125 words) can convert a fraction of "not interested"/"bad timing" to a
  continued thread; pitching harder converts objection → permanent dark or
  complaint.
- **AI-detection behavior:** 47% of professionals say they'd be less likely to
  reply to email they believe is AI-generated, yet 67% of decision-makers
  don't mind AI per se; most people correctly identify fewer than 4 of 9
  AI-vs-human emails (Hunter.io "Cold Email Confidence Gap" survey, via
  https://overloop.com/blog/ai-prospecting-statistics). The penalty is for
  *reads-like-AI genericness*, not AI use. Gartner survey of 632 B2B buyers:
  **73% actively avoid suppliers that send irrelevant outreach**. → An
  "AI-tell score" (buzzwords, symmetric clauses, "I hope this finds you
  well," generic flattery) raises instant-delete probability — it does not
  trigger an "are you a bot?" reply.

---

## B) Rep scoring rubric

### B1. Subject line
- **Sales-email data says short: 1–3 words, no punctuation/numbers/special
  chars** (Lavender, 231K emails); Gong exec data: **1–4 words best**.
  (Backlinko 2019 found 36–50 chars better — PR-outreach genre; grade against
  the sales datasets.)
- Front-load meaning: only ~33 chars visible on mobile (Lavender).
- Question-form subject: +21% opens (Woodpecker). Lowercase "colleague-style"
  subjects are practitioner consensus, not measured — soft signal.
- Penalize: spam-trigger words in subject (subjects weighted 2–3x by filters
  vs body — ReturnPath via https://litemail.ai/blog/cold-email-spam-trigger-words-2026),
  fake "RE:", >50 chars.

### B2. Length and readability
- **First touch: 50–80 words, +65% reply vs longer** (Lavender,
  https://lavender.ai/blog/best-length-cold-email); Boomerang 40M (2016):
  50–125 words, ~75 sweet spot; Gong: 50–100, sharp drop past 100. Grade:
  full marks 50–100; steep penalty >125; penalty <25 (no substance).
- **Follow-ups differ: Gong (304K follow-ups): 30–150 words outperform
  ultra-short bumps on meetings booked** — a naked "any thoughts?" bump is a
  replies-not-meetings trap
  (https://www.gong.io/blog/7-tips-for-writing-the-perfect-follow-up-sales-email-according-to-science).
- **Reading level: 3rd-grade +36% response vs college-level; +17% vs
  high-school** (Boomerang 40M, 2016). Lavender: 3rd–5th grade = **+67%
  replies**; >70% of real sales emails are 10th grade+. → Flesch-Kincaid
  target ≤ grade 5–6.
- Formatting: scannable on a phone — 1–2 sentence paragraphs, no wall of text.

### B3. Personalization vs relevance
- Grade **relevance** (right pain, right trigger, right moment) above
  **personalization tokens**. Personalized body +32.7% (Backlinko); advanced
  personalization ~2x (Woodpecker); Gartner: 73% of buyers avoid vendors
  sending irrelevant outreach.
- **Penalize cargo-cult personalization**: "I saw you went to X" openers that
  don't connect to a business reason. No public dataset isolates this line;
  the mechanism is measured indirectly (low-effort/AI-tell survey data).
  Personalization must be load-bearing to earn points; ornamental = zero;
  fake-familiar flattery = negative.
- **Prospect-focus ratio**: more "you/your" than "I/we/our"; Gong coaches
  removing "I" statements; buzzwords and vague ROI claims reduce exec replies
  (https://www.gong.io/blog/4-data-backed-ways-to-increase-your-email-reply-rate-and-book-that-meeting).
  → I/we-vs-you token ratio; penalty when the first sentence is about the
  sender's company.

### B4. CTA
- **One CTA only** (Instantly 2026). Multi-ask = penalty.
- **First touch: interest-based CTA beats meeting ask.** Gong 304K: interest
  CTA ("worth exploring?") tops cold at ~15% meeting-book rate; specific-time
  CTA wins later at 37% (2.5x soft CTAs at that stage)
  (https://www.gong.io/blog/this-surprising-cold-email-cta-will-help-you-book-a-lot-more-meetings).
  → Cold calendar-link/30-minutes ask = penalty; interest/permission ask =
  full marks; after a positive reply the *specific* time ask becomes the
  top-scoring move — the rubric is stage-aware.
- Low-friction alternatives (referral ask "who owns X?") acceptable later.

### B5. Spam signals (rep-visible deliverability)
- **First touch: no attachments, max 1 link, no tracking-heavy HTML, no
  image.** (Image data conflicts — lemlist claims +20% replies with one image;
  lemlist embeds images, flagged. Safe rule: plain text first touch,
  https://www.mailpool.ai/blog/cold-email-attachments-vs-links-whats-safe-in-2026-and-whats-not.)
- **Trigger words**: "free," "guarantee," "act now," "limited time," "100%" —
  stacking 3+ promo phrases drops inbox placement below 25% (claimed via
  secondary — flag); matters most in the subject; score cumulative,
  subject-weighted (litemail.ai above).
- ALL CAPS, multiple exclamation marks, dollar-sign strings: standard filter
  features — penalize.
- **Rep-level deliverability knowledge to test:** Gmail/Yahoo since Feb 2024
  enforce SPF/DKIM/DMARC + one-click unsubscribe + **complaints <0.3% (aim
  <0.1%)** — 3 complaints per 1,000 sends hits the threshold; blasting burns
  the domain (https://www.mailgun.com/state-of-email-deliverability/chapter/yahoogle-bulk-senders/).
  **Replies are positive engagement signals** — writing for replies is
  deliverability work.

### B6. Follow-up craft
- **Thread hygiene**: first 2–3 follow-ups in the same thread; new thread only
  for a genuinely new angle or after months
  (https://reviewmyemails.com/emailalmanac/cold-outreach-and-sales/cold-email-sequencing-follow-up/follow-ups-same-thread-vs-new).
  Bump in-thread with added value = good; new thread repeating the pitch =
  penalty.
- **Each follow-up must add new value.** Measured phrase effects on meetings
  (Gong 304K): "Thoughts?" **−20%**, "Never heard back" **−14%**, "Following
  up" **−5%**, "Hope all is well" **+24%**, "Just called" neutral.
  Guilt-tripping = hard penalty.
- **Timing**: ≥2–3 business days before FU1 (justified by Yesware latency
  data); Day 1/4/8/15 shape; 4–7 total touches; over-eager cadence graded
  harshly (spam risk triples past 4 follow-ups).
- **After an emailed objection**: reply <125 words, acknowledge, one curious
  question, no re-pitch (outboundsystem.com — practitioner). Wrong-person
  reply → thank + tight referral ask.
- **Breakup email**: present, short, clean out, one door open — 14% response,
  best of any late touch (GrowLeads 156K).
- Weekday sends +23.3% vs weekend, Wednesday peak (Backlinko; Instantly
  corroborates Monday-launch/Wednesday-peak).

---

## C) Source table

| Source | Date | Credibility |
|---|---|---|
| instantly.ai/cold-email-benchmark-report-2026 | data 2025 | Largest raw dataset (billions of sends); vendor but self-critical; primary benchmark |
| lavender.ai/blog/the-cold-email-benchmark-report | upd. Feb 2026 | 231,818 cold emails; vendor of the scoring product (grade-lift is its pitch) but methodology stated; best for content-quality effects |
| gong.io — CTA study | ~2020–21 | Gong Labs, 304,174 emails, outcome = meeting booked; strongest outcome-linked evidence |
| gong.io — follow-up study | Gong Labs | Same 304K corpus; phrase-level effects on meetings |
| gong.io — exec replies | Gong Labs | 1M+ exec cycles; seniority modifier |
| belkins.io — follow-up stats | upd. Jun 2026 | 7.5M emails, agency selection bias (pre-optimized) |
| belkins.io — response rates | 2025/26 | 16.5M emails; campaign-size and multi-contact effects |
| woodpecker.co — statistics | upd. Jun 2026 | 20M+ emails; personalization 2x; vendor, longitudinal |
| backlinko.com/email-outreach-study | 2019 | 12M emails but PR outreach — personalization/multi-contact/day-of-week only |
| blog.boomerangapp.com — response tips | 2016 | 40M emails; reading-level and length curves; old but never contradicted |
| yesware.com — follow-up stats | 2024 | Tracked-email latency; solid for latency modeling |
| marketingprofs (Litmus data) | 2022 | 9s attention, skim distribution; render tracking |
| overloop.com — AI stats (Hunter.io survey) | 2026 | 47%/67%/detection numbers; secondary aggregation |
| sopro.io — buyer statistics | 2025–26 | Survey of 404 senior decision-makers; vendor survey, decent N |
| gartner.com — b2b buying journey | ongoing | 6–10 stakeholder groups; gold standard |
| mailgun.com — Yahoogle rules | 2024 | Google/Yahoo sender rules, 0.3% threshold; authoritative |
| growleads.io — breakup templates | 2026 | 14% over 156K sequences; vendor, medium credibility |
| lemlist.com — images | 2025 | Counter-evidence on images; conflict of interest flagged |
| litemail.ai — spam trigger words | 2026 | Subject-weighted trigger analysis; vendor, medium |
| prospeo.io — reply rates | 2026 | Aggregator; contacts-per-org split; secondary |
| bravado.co / outboundsystem.com | 2024–26 | Practitioner ground truth on objection replies; qualitative |

Open questions: no public dataset isolates the "I saw you went to X" opener
(penalty inferred from low-effort/AI-tell surveys); forward-to-colleague rates
are not directly measured (rule derived from committee size + multi-contact
deltas); Instantly's per-industry table is gated.
