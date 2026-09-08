import {
  isElevenLabsVoiceConfigured,
  synthesizeElevenLabsSpeech,
  type ElevenLabsSpeech,
} from "@/llm/elevenlabs";
import {
  isKokoroSpeechConfigured,
  synthesizeKokoroSpeech,
  type KokoroSpeech,
} from "@/llm/kokoro";

type ProspectSpeech = ElevenLabsSpeech | KokoroSpeech;
type Provider = "elevenlabs" | "kokoro";

function provider(): Provider {
  const configured = process.env.SP_PROSPECT_TTS_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === "kokoro") return "kokoro";
  if (configured === "elevenlabs") return "elevenlabs";
  throw new Error("SP_PROSPECT_TTS_PROVIDER must be kokoro or elevenlabs.");
}

export function isProspectSpeechConfigured(): boolean {
  try {
    return provider() === "kokoro"
      ? isKokoroSpeechConfigured()
      : isElevenLabsVoiceConfigured();
  } catch {
    return false;
  }
}

export async function synthesizeProspectSpeech(text: string): Promise<ProspectSpeech> {
  return provider() === "kokoro"
    ? synthesizeKokoroSpeech(text)
    : synthesizeElevenLabsSpeech(text);
}
