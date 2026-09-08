import { and, eq } from "drizzle-orm";
import { getCurrentUser } from "@/auth/session";
import { db } from "@/db/client";
import { calls, callTurns } from "@/db/schema";
import { synthesizeProspectSpeech } from "@/llm/prospect-speech";

const MAX_SPEECH_CHARS = 2_000;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "rep") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: callId } = await params;
  const call = db.select().from(calls).where(eq(calls.id, callId)).get();
  if (!call || call.repId !== user.id) {
    return Response.json({ error: "Call not found" }, { status: 404 });
  }

  const body = (await request.json()) as { text?: unknown };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_SPEECH_CHARS) {
    return Response.json({ error: "Invalid speech text" }, { status: 400 });
  }

  // Prevent this endpoint becoming a general-purpose TTS relay. It may speak
  // only a prospect line already approved and persisted by the turn engine.
  const savedTurn = db
    .select({ id: callTurns.id })
    .from(callTurns)
    .where(
      and(
        eq(callTurns.callId, callId),
        eq(callTurns.speaker, "prospect"),
        eq(callTurns.text, text),
      ),
    )
    .get();
  if (!savedTurn) {
    return Response.json({ error: "Prospect turn not found" }, { status: 400 });
  }

  try {
    const speech = await synthesizeProspectSpeech(text);
    return new Response(speech.audio, {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": speech.contentType,
      },
    });
  } catch (error) {
    console.error("Prospect speech synthesis failed", error);
    return Response.json(
      { error: "Prospect audio is unavailable." },
      { status: 502 },
    );
  }
}
