import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/auth/session";
import { db } from "@/db/client";
import { calls } from "@/db/schema";
import { grantElevenLabsAccess } from "@/llm/elevenlabs";

export async function POST(
  _request: Request,
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
  if (call.status !== "live") {
    return Response.json({ error: "This call has ended" }, { status: 409 });
  }

  try {
    const grant = await grantElevenLabsAccess();
    return Response.json(grant, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("ElevenLabs token grant failed", error);
    return Response.json(
      { error: "Voice connection is unavailable." },
      { status: 502 },
    );
  }
}
