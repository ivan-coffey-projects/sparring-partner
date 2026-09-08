/**
 * Channel playbooks + async demo content. Idempotent and additive: safe on
 * fresh AND existing databases (`npm run seed:channels`). Every playbook
 * entry is distilled from docs/research/*.md — the numbers cited in entry
 * text trace to the source tables there. The entry numbering follows the
 * shared skeleton (1.x opener, 2.x message craft, 3.x cadence, 4.x asks,
 * 5.x discipline) that the engine's event→entry mapping expects.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  drillAssignments,
  drills,
  hiddenFacts,
  methodologies,
  methodologyEntries,
  prospects,
  scorecardCriteria,
  scorecards,
  users,
} from "@/db/schema";
import { newId } from "@/lib/ids";
import type {
  Channel,
  ConcessionCaps,
  PatienceConfig,
  UnlockRule,
} from "@/engine/types";

interface EntrySpec {
  number: string;
  title: string;
  text: string;
}

interface CriterionSpec {
  label: string;
  description: string;
  weight: number;
  entryNumbers: string[];
}

interface PlaybookSpec {
  methodologyName: string;
  description: string;
  scorecardName: string;
  entries: EntrySpec[];
  criteria: CriterionSpec[];
}

// ── The playbooks ────────────────────────────────────────────────────────────

const SMS_PLAYBOOK: PlaybookSpec = {
  methodologyName: "SMS Playbook",
  description:
    "Text-message selling, grounded in measured data (docs/research/sms-channel.md). Texting is earned, brief, and spaced — the reply is the scarce resource.",
  scorecardName: "SMS Thread Scorecard",
  entries: [
    {
      number: "1.1",
      title: "Earn the channel before you pitch",
      text: "Never pitch in a first text. A text that follows a real prior contact converts +112% above average; a cold pitch-first text converts below average and invites STOP. Your first text identifies you, names the context, and asks one small thing.",
    },
    {
      number: "1.2",
      title: "Say who you are, every cold open",
      text: "Name + company + how you got their number, in the first message. An unidentified text reads as spam and is a compliance failure — first outreach also carries opt-out language.",
    },
    {
      number: "2.1",
      title: "One segment, tops",
      text: "Keep texts under 160 characters and aim under 100 — sub-100-character texts get 2–5x the replies. If it can't fit in two short sentences, it belongs in an email or a call.",
    },
    {
      number: "2.2",
      title: "One specific, easy question",
      text: "Engaged leads answer direct, low-friction questions at 74–92%. A message with no question gives them nothing to answer; three questions stacked reads as a script.",
    },
    {
      number: "2.3",
      title: "Their world, their words",
      text: "Reference their inquiry, their industry, their earlier answer — not your product. Mirror their register: emoji only if they use them first, no formal email furniture.",
    },
    {
      number: "2.4",
      title: "Avoid exaggerated claims and uppercase text",
      text: "ALL CAPS, exclamation stacks, 'free', 'guarantee', 'act now' — filter-bait and human spam-radar alike. Plain language wins.",
    },
    {
      number: "3.1",
      title: "48 hours between unanswered texts",
      text: "Space follow-ups 2–3 days apart, cap the sequence at 3–5 attempts, and never text into silence on consecutive days — over-messaging is the #1 reason people opt out (53%).",
    },
    {
      number: "3.2",
      title: "Every follow-up earns its send",
      text: "Bring something new — an answer, a resource, a time option. 'Just checking in' and 'just following up' are measured reply-killers.",
    },
    {
      number: "4.1",
      title: "One clear, low-pressure ask",
      text: "One ask per message, sized to the moment: a yes/no question, two concrete time slots, never pressure. Urgency theater ('today only') converts threads into STOPs.",
    },
    {
      number: "4.2",
      title: "Trade, don't beg",
      text: "Attach every commitment ask to something they get. Asking for a call without a reason to take it is asking for a favor.",
    },
    {
      number: "5.1",
      title: "A no is a no, instantly",
      text: "STOP, 'not interested', 'leave me alone' — any wording of revocation ends the thread, immediately and permanently. Pushing past a soft no ('slammed right now') burns the lead and, past an explicit no, is a $500–$1,500-per-text legal exposure.",
    },
    {
      number: "5.2",
      title: "Right channel for the job",
      text: "Text is for scheduling, confirmations, quick questions, and links. Pricing debates, negotiations, and anything complex moves to a call or email — offer the jump, don't force it.",
    },
  ],
  criteria: [
    {
      label: "Earned opener",
      description: "Identified, contextual, permission-shaped first touch.",
      weight: 1.5,
      entryNumbers: ["1.1", "1.2"],
    },
    {
      label: "Message craft",
      description: "Short, specific, one question, their register.",
      weight: 1.5,
      entryNumbers: ["2.1", "2.2", "2.3"],
    },
    {
      label: "Cadence discipline",
      description: "Spacing, sequence caps, value per touch.",
      weight: 1.5,
      entryNumbers: ["3.1", "3.2"],
    },
    {
      label: "The ask",
      description: "One clear, low-friction, traded ask.",
      weight: 1,
      entryNumbers: ["4.1", "4.2"],
    },
    {
      label: "Channel respect",
      description: "Compliance, no spam signals, channel judgment.",
      weight: 1,
      entryNumbers: ["5.1", "5.2", "2.4"],
    },
  ],
};

const EMAIL_PLAYBOOK: PlaybookSpec = {
  methodologyName: "Email Outreach Playbook",
  description:
    "Cold email and follow-up threads, grounded in measured data (docs/research/email-channel.md). Relevance beats personalization tokens; brevity beats polish; the follow-up carries 42% of all replies.",
  scorecardName: "Email Thread Scorecard",
  entries: [
    {
      number: "1.1",
      title: "Lead with their problem, not your product",
      text: "The first sentence is about the reader — a trigger, a pain, a reason-you're-writing that is true of them specifically. Buyers punish irrelevance hardest: 73% actively avoid vendors that send irrelevant outreach.",
    },
    {
      number: "1.2",
      title: "Subject lines: short, plain, honest",
      text: "1–4 words, no punctuation tricks, no fake 'RE:', front-loaded meaning — only ~33 characters show on a phone, and 64% of buyers decide to open on the subject alone. Spam filters weight subject words 2–3x.",
    },
    {
      number: "2.1",
      title: "50–100 words, grade-5 reading level",
      text: "First-touch bodies of 50–100 words reply best (+65% vs longer); reading level of grade 3–5 lifts replies up to +67%. Short sentences, short paragraphs, scannable on a phone in nine seconds — because nine seconds is all you get.",
    },
    {
      number: "2.2",
      title: "One question, answerable from the phone",
      text: "No-question emails die; question overload also kills. Ask exactly one thing the reader can answer without opening a calendar or a document.",
    },
    {
      number: "2.3",
      title: "You-to-I ratio",
      text: "More 'you/your' than 'I/we/our'. An opener about your company is a delete; buzzwords and vague ROI claims measurably reduce executive replies. Cargo-cult personalization ('saw you went to X!') that carries no business reason counts against you.",
    },
    {
      number: "2.4",
      title: "Nothing that smells like a blast",
      text: "First touch: plain text, no attachments, at most one link, no images, no trigger-word pileups ('free', 'guarantee', 'limited time'). Every reply you earn is deliverability you bank; every complaint (0.3% is the Gmail/Yahoo line) burns the domain.",
    },
    {
      number: "3.1",
      title: "Two to three business days of silence first",
      text: "90% of replies land within a day of the open — if it's coming, it's come. Follow-up 1 adds up to +65% more replies; returns decay fast after; past four follow-ups, complaint risk triples. Day 1 / 4 / 8 / 15 is the shape.",
    },
    {
      number: "3.2",
      title: "Follow-ups add, never nag",
      text: "Each follow-up brings a new angle, asset, or fact — in the same thread, so context travels. Measured phrase effects on meetings booked: 'Thoughts?' −20%, 'never heard back' −14%, 'following up' −5%. A guilt-trip is a measured own-goal.",
    },
    {
      number: "4.1",
      title: "Interest first, calendar later",
      text: "Cold, the winning ask is interest-based ('worth a look?') — ~15% meeting rate vs a penalty for calendar-time asks. Once the thread is warm, flip it: the specific time ask becomes 2.5x better than staying vague. One CTA, always.",
    },
    {
      number: "4.2",
      title: "Handle the reply you got",
      text: "'Not interested' over email is a ten-second reflex, not a verdict: answer in under 125 words, acknowledge, ask one curious question, never re-pitch. Wrong person? Thank them and make the referral ask effortless. And send the breakup email — the clean goodbye is the best-performing late touch (≈14% response).",
    },
    {
      number: "5.1",
      title: "Unsubscribe means gone",
      text: "Any remove-me wording is honored immediately, no 'one last thing'. Blasting past it is how domains die and lists get you sued.",
    },
    {
      number: "5.2",
      title: "Write for the forward",
      text: "B2B decisions run through 6–13 people you'll never see on the thread. Write emails a champion can forward without embarrassment: self-contained, concrete, no hard sell.",
    },
  ],
  criteria: [
    {
      label: "Relevance & opener",
      description: "Reader-first opening; load-bearing personalization.",
      weight: 1.5,
      entryNumbers: ["1.1", "2.3"],
    },
    {
      label: "Subject & scannability",
      description: "Short honest subject; 50–100 words at grade 5.",
      weight: 1.5,
      entryNumbers: ["1.2", "2.1"],
    },
    {
      label: "Cadence discipline",
      description: "Spacing, thread hygiene, value-adding follow-ups.",
      weight: 1.5,
      entryNumbers: ["3.1", "3.2"],
    },
    {
      label: "The ask",
      description: "Stage-fit CTA; objection and referral craft.",
      weight: 1,
      entryNumbers: ["4.1", "4.2", "2.2"],
    },
    {
      label: "Deliverability respect",
      description: "No spam signals; unsubscribe honored; forwardable.",
      weight: 1,
      entryNumbers: ["2.4", "5.1", "5.2"],
    },
  ],
};

const INSTAGRAM_PLAYBOOK: PlaybookSpec = {
  methodologyName: "Instagram DM Playbook",
  description:
    "Instagram DM selling, grounded in platform mechanics and documented buyer behavior (docs/research/social-dm-channel.md §1). Warm inbound beats cold requests; specificity beats scripts; the bare price quote is where threads go to die.",
  scorecardName: "Instagram DM Scorecard",
  entries: [
    {
      number: "1.1",
      title: "No pitch, no link, in message one",
      text: "A pitch or link in the opener pattern-matches the 'hey hun' spam script buyers can smell in one line. Cold messages sit unread in Requests — the real play is warm inbound: story replies, comment triggers, existing followers.",
    },
    {
      number: "1.2",
      title: "Pass the swap test",
      text: "If your opener could be sent to anyone, it's a mass message and reads like one. Reference something only THIS person posted, said, or runs — generic compliments ('love your vibe') score zero and cost trust.",
    },
    {
      number: "2.1",
      title: "Two short lines, not a paragraph",
      text: "DMs are bursts, not essays: 1–2 short casual messages, lowercase fine, emoji in their register. A wall of text is a documented ghost trigger.",
    },
    {
      number: "2.2",
      title: "A question before any offer",
      text: "Diagnose before you prescribe: one easy question ('are you doing A or B right now?') before anything that smells like selling. Permission-based pitches ('want me to share how I'd approach it?') keep the door open.",
    },
    {
      number: "2.3",
      title: "Match their energy, stay a stranger",
      text: "Friendly, casual, human — but no manufactured intimacy. 'Hun', 'babe', 'girl', instant familiarity with a stranger: that's the MLM script, and it gets screenshotted.",
    },
    {
      number: "2.4",
      title: "No urgency theater",
      text: "Deadlines, 'spots filling fast', too-good prices, off-platform payment pushes — every one of these is a documented scam-radar trigger that ends with a block.",
    },
    {
      number: "3.1",
      title: "Respect the seen",
      text: "Left on seen is an answer — for now. Give it a day before following up, and never stack unanswered messages. Ghosting culture is the medium; crowding reads as desperation.",
    },
    {
      number: "3.2",
      title: "Return with something, or don't",
      text: "A revival message carries a reason: something new, something useful, something about them. 'Just bumping this!' earns the second ghost.",
    },
    {
      number: "4.1",
      title: "Price travels with context",
      text: "The 'how much?' → bare number → silence pattern is the single most documented DM deal-death. Answer the price question with an anchor, a range with a reason, and a follow-up question — never a naked figure as the thread-ender.",
    },
    {
      number: "4.2",
      title: "Close where the platform closes",
      text: "The close is a checkout link, a booking link after one qualifying question, or a move to WhatsApp — native checkout has been discontinued. High-ticket conversations take 8–15 messages over several days; sending the booking link too early also reduces mid-ticket conversions.",
    },
    {
      number: "5.1",
      title: "Blocked means over",
      text: "A block, a 'stop messaging me', a report — the thread is done, permanently, on every account you have.",
    },
    {
      number: "5.2",
      title: "Prove it when challenged",
      text: "'Is this legit?' gets receipts: reviews, real photos, an offer to hop on a call — never pressure. An evasive answer to a trust challenge is a confession.",
    },
  ],
  criteria: [
    {
      label: "Earned opener",
      description: "Warm, specific, swap-test-passing first touch.",
      weight: 1.5,
      entryNumbers: ["1.1", "1.2"],
    },
    {
      label: "Native craft",
      description: "Short bursts, their register, question-first.",
      weight: 1.5,
      entryNumbers: ["2.1", "2.2", "2.3"],
    },
    {
      label: "Ghost respect",
      description: "Seen-handling, spaced value-bearing follow-ups.",
      weight: 1.5,
      entryNumbers: ["3.1", "3.2"],
    },
    {
      label: "Price & close",
      description: "Context-wrapped pricing; platform-correct close path.",
      weight: 1.5,
      entryNumbers: ["4.1", "4.2"],
    },
    {
      label: "Trust & safety",
      description: "No spam patterns, no pressure, proof on challenge.",
      weight: 1,
      entryNumbers: ["2.4", "5.1", "5.2"],
    },
  ],
};

const LINKEDIN_PLAYBOOK: PlaybookSpec = {
  methodologyName: "LinkedIn DM Playbook",
  description:
    "LinkedIn messaging, grounded in the platform's own data and studies covering 15–20 million requests (docs/research/social-dm-channel.md §2). Accurate recipient research and a measured opening are essential; median buyer response time is approximately 22 hours.",
  scorecardName: "LinkedIn DM Scorecard",
  entries: [
    {
      number: "1.1",
      title: "Do not pitch immediately after connection",
      text: "An offer or calendar ask in the first messages after connecting drops reply odds to ~1–2% and risks the connection itself. The first exchange earns the right to a second — that's all it's for.",
    },
    {
      number: "1.2",
      title: "Do the homework, show the homework",
      text: "79% of buyers won't engage a seller who doesn't know their company, and wrong information is the #1 measured deal-killer. One accurate, specific reference to their role, company, or content is worth more than any template — and one wrong claim costs more than silence.",
    },
    {
      number: "2.1",
      title: "Under 400 characters",
      text: "LinkedIn's own data: messages under 400 characters get +22% responses; past 800 they sink, past 1,200 they're −11%. Business-casual, 1–3 sentences, no 'Dear', no signature block.",
    },
    {
      number: "2.2",
      title: "One conversational question",
      text: "End with one question a busy person can answer from their phone. A message with nothing to respond to gets exactly that.",
    },
    {
      number: "2.3",
      title: "About them, not your deck",
      text: "The message is about their world. The moment it reads like a brochure — buzzwords, 'we help companies like yours', feature lists — it's a delete with prejudice.",
    },
    {
      number: "2.4",
      title: "No link in the invite",
      text: "Connection notes with links or sales language have the worst acceptance rates in every study. A note is optional (it doesn't move acceptance) — but a good one lifts the reply that follows by 55–72%.",
    },
    {
      number: "3.1",
      title: "Days between touches, not hours",
      text: "The median buyer reply takes approximately 22 hours, with limited weekend activity. Following up within hours of silence is a negative signal. Space follow-ups several days apart and stop by touch five — 40–60% of replies come from touches 2–4, with very few after six.",
    },
    {
      number: "3.2",
      title: "New value or no touch",
      text: "Each follow-up brings a different angle: an insight, a relevant post, a mutual thread. Re-sending the pitch in new words is sequence spam, and buyers are saturated with it — note reply rates fell 37% in a year from template fatigue.",
    },
    {
      number: "4.1",
      title: "Interest ask, not calendar ask",
      text: "'Worth a look?' outperforms 'got 30 minutes Tuesday?' roughly 2x until the prospect has engaged. The call ask comes after they've asked a question or named a pain — not before.",
    },
    {
      number: "4.2",
      title: "Move off-platform when they lean in",
      text: "Buyers willingly shift to email or a call once contact has proven thoughtful. Offer the jump as a convenience for them, framed around what they get.",
    },
    {
      number: "5.1",
      title: "A brush-off is binding",
      text: "'Not interested, thanks' on LinkedIn is final — pushing past it risks the connection, a report, and your company's name in a screenshot.",
    },
    {
      number: "5.2",
      title: "Warm up before you show up",
      text: "Commenting genuinely on their posts before the invite measurably lifts both acceptance and replies. Cold is a choice — a worse one.",
    },
  ],
  criteria: [
    {
      label: "Homework & entry",
      description: "Accurate, specific, pitch-free first exchange.",
      weight: 2,
      entryNumbers: ["1.1", "1.2", "2.4"],
    },
    {
      label: "Message craft",
      description: "<400 chars, business-casual, one question, about them.",
      weight: 1.5,
      entryNumbers: ["2.1", "2.2", "2.3"],
    },
    {
      label: "Cadence patience",
      description: "Day-scale spacing; value per touch; stops by five.",
      weight: 1.5,
      entryNumbers: ["3.1", "3.2"],
    },
    {
      label: "The ask",
      description: "Interest-based ask; earned off-platform move.",
      weight: 1,
      entryNumbers: ["4.1", "4.2"],
    },
    {
      label: "Professional respect",
      description: "Brush-offs honored; warm-up over cold volume.",
      weight: 1,
      entryNumbers: ["5.1", "5.2"],
    },
  ],
};

const CALL_NEEDLE_MOVERS: PlaybookSpec = {
  methodologyName: "Needle Movers — Live Calls",
  description:
    "The call behaviors with real evidence behind them (docs/research/scoring-metrics.md): question targeting, problem depth, next steps, multithreading, and indecision handling. Built for reviewing real call transcripts; folklore metrics (filler words, magic ratios) deliberately excluded.",
  scorecardName: "Real Call Scorecard",
  entries: [
    {
      number: "1.1",
      title: "Questions that target, spread through the call",
      text: "11–14 targeted questions is the discovery sweet spot (519K-call data) — aimed at business problems, spread through the conversation. Front-loading them into a checklist interrogation correlates worse than asking fewer, better ones.",
    },
    {
      number: "1.2",
      title: "Three to four problems, deep",
      text: "Win rates peak when 3–4 distinct business problems are surfaced AND explored at least two layers down. One problem skimmed is a demo request; four problems opened is a deal.",
    },
    {
      number: "1.3",
      title: "Develop the implication",
      text: "After a problem is admitted, extend it: what does it cost, who feels it, what happens if it stays. Implication questions were the strongest close predictor in the original 35,000-call SPIN research, and top performers ask 4x more of them.",
    },
    {
      number: "2.1",
      title: "Dialogue, not lecture",
      text: "Keep rep talk roughly 40–60% with no monologue past two and a half minutes. This is hygiene, not magic — top reps hold the same ratio in wins and losses — but the extremes are where calls die.",
    },
    {
      number: "2.2",
      title: "Leave with a next step that has a date",
      text: "The industry's consensus #1 close-of-call behavior: a concrete next step with an owner, an artifact, and a date, agreed out loud. 'I'll follow up' is not a next step.",
    },
    {
      number: "2.3",
      title: "Widen the room",
      text: "Won deals carry twice the buyer-side contacts; multithreading lifts win rates +130% on larger deals. Ask who else is affected, who else evaluates, and get a name — every call.",
    },
    {
      number: "3.1",
      title: "Price without flinching",
      text: "Address pricing transparently when it comes up; in demos, land it after value (deal-closing demos put it in the back half). Three to four buyer pricing exchanges is the healthy band — zero is avoidance, more is alarm.",
    },
    {
      number: "3.2",
      title: "Name the competition early",
      text: "Surfacing the competitive landscape early in the cycle correlates with +32–49% win odds; discovering a competitor late is how deals are lost silently. Ask what else they're considering — including doing nothing.",
    },
    {
      number: "4.1",
      title: "Treat indecision, not the status quo",
      text: "40–60% of qualified pipeline dies in no-decision, and most of that is fear of messing up — not preference for the status quo. Re-pitching ROI at an indecisive buyer backfires (measured). Instead: make a firm recommendation (18%→44% win lift), cap the exploration, and take risk off the table — pilots, opt-outs, guarantees (+32%).",
    },
    {
      number: "4.2",
      title: "Cold open with context, not permission theater",
      text: "State who you are and the reason for the call up front (2.1x); 'did I catch you at a bad time?' measurably hurts (−40%). Drive the first two minutes; a prospect asking questions back is the tell it's working.",
    },
  ],
  criteria: [
    {
      label: "Discovery depth",
      description: "Targeted questions, 3–4 problems, implications developed.",
      weight: 2,
      entryNumbers: ["1.1", "1.2", "1.3"],
    },
    {
      label: "Momentum",
      description: "Dated next step; committee widened.",
      weight: 1.5,
      entryNumbers: ["2.2", "2.3"],
    },
    {
      label: "Deal navigation",
      description: "Pricing faced; competition surfaced early.",
      weight: 1,
      entryNumbers: ["3.1", "3.2"],
    },
    {
      label: "Closing psychology",
      description: "Indecision judged and de-risked, not ROI-blasted.",
      weight: 1.5,
      entryNumbers: ["4.1"],
    },
    {
      label: "Dialogue hygiene",
      description: "Balanced airtime; context-first openers.",
      weight: 0.5,
      entryNumbers: ["2.1", "4.2"],
    },
  ],
};

const PLAYBOOKS: PlaybookSpec[] = [
  SMS_PLAYBOOK,
  EMAIL_PLAYBOOK,
  INSTAGRAM_PLAYBOOK,
  LINKEDIN_PLAYBOOK,
  CALL_NEEDLE_MOVERS,
];

// ── Demo async prospects & drills ────────────────────────────────────────────

interface DemoFactSpec {
  label: string;
  topic: string;
  truth: string;
  politeLie: string;
  unlockRule: UnlockRule;
}

interface DemoProspectSpec {
  channel: Channel;
  playbookName: string;
  name: string;
  jobTitle: string;
  company: string;
  persona: string;
  openingLine: string;
  patienceConfig: PatienceConfig;
  concessionCaps: ConcessionCaps;
  facts: DemoFactSpec[];
  drillTitle: string;
  drillBriefing: string;
}

const ASYNC_PATIENCE: PatienceConfig = {
  // For async channels only `initial` matters (starting engagement); the
  // rest are live-call knobs kept sane in case the prospect is reused there.
  initial: 55,
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

const ASYNC_CAPS: ConcessionCaps = {
  meetingRequiresFactsUnlocked: 2,
  meetingRequiresPatienceAtLeast: 45,
  allowIntro: false,
  introRequiresFactsUnlocked: 3,
  allowPilot: false,
  maxPilotBudget: 0,
  pilotRequiresFactsUnlocked: 5,
  allowTimelineChange: false,
  maxConcessionsTotal: 1,
};

const DEMO_PROSPECTS: DemoProspectSpec[] = [
  {
    channel: "sms",
    playbookName: "SMS Playbook",
    name: "Riley Novak",
    jobTitle: "Fleet Manager",
    company: "Halvard Distribution",
    persona:
      "Riley runs a 60-truck fleet and filled out the demo form on your website twenty minutes ago, between dispatch fires. Texts in short bursts, hates fluff, answers direct questions fast and ignores anything that smells like a script. Warms up when someone clearly read the form and knows fleet life; goes quiet the moment a message turns into a brochure.",
    openingLine:
      "Hi — filled out the form on your site. Does it handle multi-stop or just point to point?",
    patienceConfig: { ...ASYNC_PATIENCE, initial: 62 },
    concessionCaps: ASYNC_CAPS,
    facts: [
      {
        label: "What broke this morning",
        topic: "pain_cost",
        truth:
          "Two drivers sat idle three hours today because the routing board double-booked a dock. It's the third time this month and the ops director chewed Riley out for it.",
        politeLie: "Just doing some general research on tools.",
        unlockRule: { type: "reflection", topic: "pain_cost", minAccuracy: 0.6 },
      },
      {
        label: "The real evaluation",
        topic: "timeline",
        truth:
          "Riley has to present two vendor options to the ops director next Thursday. Whoever texts back useful answers fastest is on that shortlist.",
        politeLie: "No rush on our end.",
        unlockRule: { type: "trust", minTrust: 12 },
      },
      {
        label: "Budget reality",
        topic: "budget",
        truth:
          "There's sign-off up to $2k/month without a committee, anything above that stalls for a quarter.",
        politeLie: "Haven't really thought about budget.",
        unlockRule: { type: "reflection", topic: "budget", minAccuracy: 0.7 },
      },
    ],
    drillTitle: "Inbound text: the fleet manager who just applied",
    drillBriefing:
      "Riley texted first — this lead is warm and it's yours to lose. Keep every text under two sentences, answer the actual question, and earn the next one. The win is a booked call, but only after you know what broke and when they're deciding.",
  },
  {
    channel: "email",
    playbookName: "Email Outreach Playbook",
    name: "Priya Shah",
    jobTitle: "Director of Revenue Operations",
    company: "Lattice & Vine",
    persona:
      "Priya gets forty cold emails a day and reads them in nine seconds on her phone, deleting anything long, vague, or about the sender. Replies to emails that name something true about her world in the first line. Dry, precise, allergic to buzzwords. Forwards genuinely useful emails to her VP.",
    openingLine: "",
    patienceConfig: { ...ASYNC_PATIENCE, initial: 50 },
    concessionCaps: { ...ASYNC_CAPS, meetingRequiresPatienceAtLeast: 50 },
    facts: [
      {
        label: "The reporting mess",
        topic: "pain_cost",
        truth:
          "Board reporting takes her team four days a quarter because CRM data and billing data disagree; last quarter's board deck had a revenue number that was wrong by 6%.",
        politeLie: "Our reporting is mostly under control.",
        unlockRule: { type: "reflection", topic: "pain_cost", minAccuracy: 0.6 },
      },
      {
        label: "Who really decides",
        topic: "authority",
        truth:
          "The VP of Finance owns the tooling budget; Priya can champion but not sign. She got burned championing a tool that flopped and won't stick her neck out without proof.",
        politeLie: "I'd be the one making the call on this.",
        unlockRule: { type: "reflection", topic: "authority", minAccuracy: 0.7 },
      },
      {
        label: "The renewal window",
        topic: "timeline",
        truth:
          "Their current BI contract renews in nine weeks. If nothing better is on the table by then, they're locked for another year and she stops looking.",
        politeLie: "We're not on any particular timeline.",
        unlockRule: { type: "trust", minTrust: 16 },
      },
    ],
    drillTitle: "Cold email: nine seconds with the RevOps director",
    drillBriefing:
      "You're opening cold. Priya has never heard of you and reads email on her phone with her thumb on delete. Under 100 words, about her world, one easy ask — and when the silence comes, your follow-up spacing and value-per-touch are being graded as hard as your opener.",
  },
  {
    channel: "dm_instagram",
    playbookName: "Instagram DM Playbook",
    name: "Maya Torres",
    jobTitle: "Owner",
    company: "Northside Strength Studio",
    persona:
      "Maya runs a boutique gym with 22k followers and just replied 🔥 to your story about client-retention dashboards. Types in short lowercase bursts with emoji, checks DMs between coaching blocks, and has been pitched by every 'hey girl' account on the platform — her spam radar is instant. Asks 'how much' early and ghosts bare numbers.",
    openingLine: "🔥🔥 this is exactly what i've been trying to build in sheets lol",
    patienceConfig: { ...ASYNC_PATIENCE, initial: 65 },
    concessionCaps: ASYNC_CAPS,
    facts: [
      {
        label: "The churn scare",
        topic: "pain_cost",
        truth:
          "She lost 19 members in two months and only noticed when the rent check felt tight — her spreadsheet tracking is three weeks behind reality.",
        politeLie: "retention's pretty solid tbh, just curious",
        unlockRule: { type: "reflection", topic: "pain_cost", minAccuracy: 0.6 },
      },
      {
        label: "What she'll actually pay",
        topic: "budget",
        truth:
          "She'd pay up to $150/month without blinking for something that just works; anything with a setup fee or a call-to-see-pricing page is an instant no.",
        politeLie: "how much is it? just curious",
        unlockRule: { type: "reflection", topic: "budget", minAccuracy: 0.7 },
      },
      {
        label: "The scam scar",
        topic: "incumbent",
        truth:
          "She paid $800 to a 'gym growth coach' from Instagram last year and got a Canva PDF. Anyone who pushes urgency or payment links gets blocked on sight.",
        politeLie: "i've tried a couple things before, they were fine",
        unlockRule: { type: "trust", minTrust: 14 },
      },
    ],
    drillTitle: "Story reply: the gym owner who's been burned",
    drillBriefing:
      "Maya replied to your story — warm inbound, her language, her platform. Match her register, ask before you offer, and when 'how much' arrives (it will, early), remember: a bare number ends this thread. The close is a booking link she asked for, not one you pushed.",
  },
  {
    channel: "dm_linkedin",
    playbookName: "LinkedIn DM Playbook",
    name: "Tom Beckett",
    jobTitle: "VP of Sales",
    company: "Merrow Industrial",
    persona:
      "Tom accepted your connection request yesterday. He receives several immediate sales pitches each week and quietly removes those connections. He usually replies the following day in two polite, business-casual sentences, and only to people who clearly understand Merrow. A calendar link in the first message receives no response.",
    openingLine: "",
    patienceConfig: { ...ASYNC_PATIENCE, initial: 52 },
    concessionCaps: { ...ASYNC_CAPS, meetingRequiresPatienceAtLeast: 50 },
    facts: [
      {
        label: "The ramp problem",
        topic: "pain_cost",
        truth:
          "His new AEs take nine months to ramp and he's losing two a year to frustration in the meantime; the board asked him to fix ramp time by Q3.",
        politeLie: "Team's performing well, always room to improve.",
        unlockRule: { type: "reflection", topic: "pain_cost", minAccuracy: 0.6 },
      },
      {
        label: "The failed tool",
        topic: "incumbent",
        truth:
          "They bought a call-recording platform two years ago that nobody opens; Tom personally signed for it and quietly resents the vendor's 'check-in' emails.",
        politeLie: "We've got tooling in place for coaching.",
        unlockRule: { type: "reflection", topic: "incumbent", minAccuracy: 0.7 },
      },
      {
        label: "What would move him",
        topic: "timeline",
        truth:
          "He's presenting a sales-productivity plan to the board in six weeks and privately doesn't have a strong third initiative for the deck.",
        politeLie: "Nothing pressing on the horizon.",
        unlockRule: { type: "trust", minTrust: 16 },
      },
    ],
    drillTitle: "Post-acceptance: the VP who receives too many immediate pitches",
    drillBriefing:
      "Tom accepted your connection yesterday. One pitch, one calendar link, one wrong fact about Merrow — and this thread is over without a reply. Under 400 characters, homework visible, interest-based asks only. He answers on his clock, not yours: the wait button is part of the skill.",
  },
];

// ── Idempotent writers ───────────────────────────────────────────────────────

function ensurePlaybook(trainerId: string, spec: PlaybookSpec): void {
  const existing = db
    .select({ id: methodologies.id })
    .from(methodologies)
    .where(
      and(
        eq(methodologies.trainerId, trainerId),
        eq(methodologies.name, spec.methodologyName),
      ),
    )
    .get();
  if (existing) return;

  const now = Date.now();
  const methodologyId = newId();
  db.insert(methodologies)
    .values({
      id: methodologyId,
      trainerId,
      name: spec.methodologyName,
      description: spec.description,
      createdAt: now,
    })
    .run();

  const entryIdsByNumber = new Map<string, string>();
  db.insert(methodologyEntries)
    .values(
      spec.entries.map((entry, i) => {
        const id = newId();
        entryIdsByNumber.set(entry.number, id);
        return {
          id,
          methodologyId,
          number: entry.number,
          title: entry.title,
          text: entry.text,
          sortOrder: i,
        };
      }),
    )
    .run();

  const scorecardId = newId();
  db.insert(scorecards)
    .values({
      id: scorecardId,
      trainerId,
      methodologyId,
      name: spec.scorecardName,
      createdAt: now,
    })
    .run();
  db.insert(scorecardCriteria)
    .values(
      spec.criteria.map((criterion, i) => ({
        id: newId(),
        scorecardId,
        label: criterion.label,
        description: criterion.description,
        weight: criterion.weight,
        methodologyEntryIds: criterion.entryNumbers.map((n) => {
          const id = entryIdsByNumber.get(n);
          if (!id) throw new Error(`Unknown entry number ${n} in ${spec.methodologyName}`);
          return id;
        }),
        sortOrder: i,
      })),
    )
    .run();
  console.log(`  playbook  ${spec.methodologyName} + ${spec.scorecardName}`);
}

function ensureDemoProspect(
  trainerId: string,
  repId: string | null,
  spec: DemoProspectSpec,
): void {
  const existing = db
    .select({ id: prospects.id })
    .from(prospects)
    .where(
      and(eq(prospects.trainerId, trainerId), eq(prospects.name, spec.name)),
    )
    .get();
  if (existing) return;

  const scorecard = db
    .select({ id: scorecards.id, methodologyId: scorecards.methodologyId })
    .from(scorecards)
    .innerJoin(methodologies, eq(scorecards.methodologyId, methodologies.id))
    .where(
      and(
        eq(methodologies.trainerId, trainerId),
        eq(methodologies.name, spec.playbookName),
      ),
    )
    .get();
  if (!scorecard) throw new Error(`Playbook missing: ${spec.playbookName}`);

  const now = Date.now();
  const prospectId = newId();
  db.insert(prospects)
    .values({
      id: prospectId,
      trainerId,
      name: spec.name,
      jobTitle: spec.jobTitle,
      company: spec.company,
      persona: spec.persona,
      dealContext: "",
      openingLine: spec.openingLine,
      patienceConfig: spec.patienceConfig,
      concessionCaps: spec.concessionCaps,
      createdAt: now,
    })
    .run();
  db.insert(hiddenFacts)
    .values(
      spec.facts.map((fact, i) => ({
        id: newId(),
        prospectId,
        label: fact.label,
        topic: fact.topic,
        truth: fact.truth,
        politeLie: fact.politeLie,
        unlockRule: fact.unlockRule,
        sortOrder: i,
      })),
    )
    .run();

  const drillId = newId();
  db.insert(drills)
    .values({
      id: drillId,
      trainerId,
      prospectId,
      scorecardId: scorecard.id,
      title: spec.drillTitle,
      channel: spec.channel,
      briefing: spec.drillBriefing,
      createdAt: now,
    })
    .run();
  if (repId) {
    db.insert(drillAssignments)
      .values({ id: newId(), drillId, repId, createdAt: now })
      .run();
  }
  console.log(`  prospect  ${spec.name} → drill "${spec.drillTitle}"`);
}

/** Seeds playbooks + async demo content for the first trainer. Idempotent. */
export function ensureChannelContent(): void {
  const trainer = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "trainer"))
    .get();
  if (!trainer) {
    console.log("No trainer exists yet — run the base seed (npm run seed) first.");
    return;
  }
  const rep = db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.role, "rep"))
    .get();

  console.log("Channel playbooks & async demo content:");
  for (const playbook of PLAYBOOKS) {
    ensurePlaybook(trainer.id, playbook);
  }
  for (const prospect of DEMO_PROSPECTS) {
    ensureDemoProspect(trainer.id, rep?.id ?? null, prospect);
  }
  console.log("Done.");
}

// Standalone invocation: npm run seed:channels
if (process.argv[1]?.endsWith("seed-channels.ts")) {
  ensureChannelContent();
}
