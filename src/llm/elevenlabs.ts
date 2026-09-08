const DEFAULT_BASE_URL = "https://api.elevenlabs.io";
const DEFAULT_STT_MODEL = "scribe_v2_realtime";
const DEFAULT_TTS_MODEL = "eleven_flash_v2_5";
const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb";

export interface ElevenLabsAccessGrant {
  token: string;
  expiresIn: number;
  baseUri: string;
  modelId: string;
}

export interface ElevenLabsSpeech {
  audio: ArrayBuffer;
  contentType: string;
}

function apiKey(): string {
  const key = process.env.ELEVENLABS_API_KEY?.trim();
  if (!key) throw new Error("ElevenLabs voice is not configured.");
  return key;
}

function baseUrl(): URL {
  const raw = process.env.SP_ELEVENLABS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("SP_ELEVENLABS_BASE_URL must use HTTP or HTTPS.");
  }
  return url;
}

function apiUrl(pathname: string): URL {
  return new URL(pathname, baseUrl());
}

function voiceId(): string {
  return process.env.SP_ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
}

export function isElevenLabsVoiceConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

export function buildElevenLabsRealtimeBaseUri(): string {
  const url = baseUrl();
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = url.pathname.replace(/\/$/, "");
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

/**
 * Creates a single-use Scribe token. The permanent account key never reaches
 * the browser and the provider consumes the token on its first connection.
 */
export async function grantElevenLabsAccess(): Promise<ElevenLabsAccessGrant> {
  const response = await fetch(
    apiUrl("/v1/single-use-token/realtime_scribe"),
    {
      method: "POST",
      headers: { "xi-api-key": apiKey() },
      cache: "no-store",
    },
  );
  if (!response.ok) {
    throw new Error(`ElevenLabs token grant failed (${response.status}).`);
  }

  const data = (await response.json()) as { token?: unknown };
  if (typeof data.token !== "string" || !data.token) {
    throw new Error("ElevenLabs returned an invalid token grant.");
  }

  return {
    token: data.token,
    expiresIn: 15 * 60,
    baseUri: buildElevenLabsRealtimeBaseUri(),
    modelId:
      process.env.SP_ELEVENLABS_STT_MODEL?.trim() || DEFAULT_STT_MODEL,
  };
}

/**
 * Converts an engine-approved prospect turn to audio. Hidden facts and engine
 * state never enter this request; the caller passes only persisted speech.
 */
export async function synthesizeElevenLabsSpeech(
  text: string,
): Promise<ElevenLabsSpeech> {
  const url = apiUrl(`/v1/text-to-speech/${encodeURIComponent(voiceId())}`);
  url.searchParams.set("output_format", "mp3_44100_128");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id:
        process.env.SP_ELEVENLABS_TTS_MODEL?.trim() || DEFAULT_TTS_MODEL,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`ElevenLabs speech synthesis failed (${response.status}).`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}
