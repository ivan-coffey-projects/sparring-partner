import { notFound, redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireUser } from "@/auth/session";
import { db } from "@/db/client";
import {
  calls,
  callTurns,
  drills,
  hiddenFacts,
  prospects,
} from "@/db/schema";
import { sql } from "drizzle-orm";
import { CallClient } from "@/app/calls/[id]/call-client";
import { ThreadClient } from "@/app/calls/[id]/thread-client";
import { isAsyncChannel } from "@/engine/types";
import { isElevenLabsVoiceConfigured } from "@/llm/elevenlabs";
import { isProspectSpeechConfigured } from "@/llm/prospect-speech";

export const metadata = { title: "Live call" };
// Reads the database, so it must never be prerendered: a build would
// otherwise open and migrate one as a side effect of rendering.
export const dynamic = "force-dynamic";

export default async function CallPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("rep");
  const { id } = await params;

  const call = db.select().from(calls).where(eq(calls.id, id)).get();
  if (!call || call.repId !== user.id) notFound();
  if (call.status === "ended") redirect(`/calls/${id}/debrief`);

  const drill = db
    .select()
    .from(drills)
    .where(eq(drills.id, call.drillId))
    .get();
  if (!drill) notFound();
  const prospect = db
    .select({
      name: prospects.name,
      jobTitle: prospects.jobTitle,
      company: prospects.company,
    })
    .from(prospects)
    .where(eq(prospects.id, drill.prospectId))
    .get();
  if (!prospect) notFound();

  const factCount =
    db
      .select({ n: sql<number>`count(*)` })
      .from(hiddenFacts)
      .where(eq(hiddenFacts.prospectId, drill.prospectId))
      .get()?.n ?? 0;

  const turns = db
    .select()
    .from(callTurns)
    .where(eq(callTurns.callId, id))
    .orderBy(asc(callTurns.idx))
    .all();

  if (isAsyncChannel(drill.channel)) {
    return (
      <ThreadClient
        callId={id}
        channel={drill.channel}
        prospect={prospect}
        briefing={drill.briefing}
        initialEngagement={call.patience}
        initialUnlockedCount={call.unlockedFactIds.length}
        factsTotal={factCount}
        initialTurns={turns.map((t) => ({
          id: t.id,
          speaker: t.speaker,
          text: t.text,
          meta: t.meta,
        }))}
        initialSimClockMinutes={call.channelState?.simClockMinutes ?? 0}
      />
    );
  }

  return (
    <CallClient
      callId={id}
      prospect={prospect}
      briefing={drill.briefing}
      initialPatience={call.patience}
      initialUnlockedCount={call.unlockedFactIds.length}
      factsTotal={factCount}
      microphoneAvailable={isElevenLabsVoiceConfigured()}
      prospectSpeechAvailable={isProspectSpeechConfigured()}
      initialTurns={turns
        .filter((t) => t.speaker !== "system")
        .map((t) => ({
          id: t.id,
          speaker: t.speaker as "rep" | "prospect",
          text: t.text,
        }))}
    />
  );
}
