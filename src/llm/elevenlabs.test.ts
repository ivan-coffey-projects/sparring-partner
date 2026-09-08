import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildElevenLabsRealtimeBaseUri,
  grantElevenLabsAccess,
  isElevenLabsVoiceConfigured,
  synthesizeElevenLabsSpeech,
} from "@/llm/elevenlabs";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("ElevenLabs voice adapter", () => {
  it("reports whether the provider is configured", () => {
    delete process.env.ELEVENLABS_API_KEY;
    expect(isElevenLabsVoiceConfigured()).toBe(false);
    process.env.ELEVENLABS_API_KEY = "test-key";
    expect(isElevenLabsVoiceConfigured()).toBe(true);
  });

  it("builds a realtime base URI that can target a local mimic", () => {
    process.env.SP_ELEVENLABS_BASE_URL = "http://voice.test:9000";
    expect(buildElevenLabsRealtimeBaseUri()).toBe("ws://voice.test:9000");
  });

  it("grants a single-use token without exposing the permanent key", async () => {
    process.env.ELEVENLABS_API_KEY = "server-secret";
    process.env.SP_ELEVENLABS_STT_MODEL = "scribe-test";
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ token: "single-use-token" }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const grant = await grantElevenLabsAccess();

    expect(grant).toMatchObject({
      token: "single-use-token",
      expiresIn: 900,
      modelId: "scribe-test",
    });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: "/v1/single-use-token/realtime_scribe",
      }),
      expect.objectContaining({
        method: "POST",
        headers: { "xi-api-key": "server-secret" },
      }),
    );
  });

  it("synthesizes only the supplied prospect text", async () => {
    process.env.ELEVENLABS_API_KEY = "server-secret";
    process.env.SP_ELEVENLABS_VOICE_ID = "prospect-voice";
    process.env.SP_ELEVENLABS_TTS_MODEL = "flash-test";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeElevenLabsSpeech("Approved reply.");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];

    expect(url.pathname).toBe("/v1/text-to-speech/prospect-voice");
    expect(url.searchParams.get("output_format")).toBe("mp3_44100_128");
    expect(init.headers).toEqual(
      expect.objectContaining({ "xi-api-key": "server-secret" }),
    );
    expect(JSON.parse(String(init.body))).toEqual({
      text: "Approved reply.",
      model_id: "flash-test",
    });
    expect(result.contentType).toBe("audio/mpeg");
    expect(Array.from(new Uint8Array(result.audio))).toEqual([1, 2, 3]);
  });
});
