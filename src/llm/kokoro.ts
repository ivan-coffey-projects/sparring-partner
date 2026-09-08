const DEFAULT_BASE_URL = "http://127.0.0.1:8880";
const DEFAULT_MODEL = "kokoro";
const DEFAULT_VOICE_ID = "am_adam";

export interface KokoroSpeech {
  audio: ArrayBuffer;
  contentType: string;
}

function baseUrl(): URL {
  const raw = process.env.SP_KOKORO_TTS_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const url = new URL(raw);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("SP_KOKORO_TTS_BASE_URL must use HTTP or HTTPS.");
  }
  return url;
}

function apiUrl(pathname: string): URL {
  return new URL(pathname, baseUrl());
}

export function isKokoroSpeechConfigured(): boolean {
  try {
    baseUrl();
    return true;
  } catch {
    return false;
  }
}

/** Converts an engine-approved prospect turn to speech through local Kokoro. */
export async function synthesizeKokoroSpeech(text: string): Promise<KokoroSpeech> {
  const response = await fetch(apiUrl("/v1/audio/speech"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.SP_KOKORO_TTS_MODEL?.trim() || DEFAULT_MODEL,
      input: text,
      voice: process.env.SP_KOKORO_TTS_VOICE?.trim() || DEFAULT_VOICE_ID,
      response_format: "mp3",
      stream: false,
    }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Kokoro speech synthesis failed (${response.status}).`);
  }

  return {
    audio: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") || "audio/mpeg",
  };
}
