import { afterEach, describe, expect, it, vi } from "vitest";
import { synthesizeKokoroSpeech } from "@/llm/kokoro";

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.unstubAllGlobals();
});

describe("Kokoro speech adapter", () => {
  it("synthesizes an approved prospect line through the local OpenAI-compatible API", async () => {
    process.env.SP_KOKORO_TTS_BASE_URL = "http://kokoro.test:8880";
    process.env.SP_KOKORO_TTS_VOICE = "prospect-voice";
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "audio/mpeg" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await synthesizeKokoroSpeech("Approved reply.");
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];

    expect(url.toString()).toBe("http://kokoro.test:8880/v1/audio/speech");
    expect(JSON.parse(String(init.body))).toEqual({
      model: "kokoro",
      input: "Approved reply.",
      voice: "prospect-voice",
      response_format: "mp3",
      stream: false,
    });
    expect(Array.from(new Uint8Array(result.audio))).toEqual([1, 2, 3]);
  });
});
