"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CommitStrategy,
  RealtimeEvents,
  Scribe,
  type RealtimeConnection,
} from "@elevenlabs/client";

export type VoicePhase =
  | "idle"
  | "connecting"
  | "listening"
  | "processing"
  | "speaking";

interface ElevenLabsGrant {
  token: string;
  expiresIn: number;
  baseUri: string;
  modelId: string;
}

interface UseElevenLabsVoiceOptions {
  callId: string;
  microphoneEnabled: boolean;
  speechEnabled: boolean;
  onTranscript: (text: string) => void;
  onFinalTranscript: (text: string) => void;
  onError: (message: string) => void;
}

export function useElevenLabsVoice({
  callId,
  microphoneEnabled,
  speechEnabled,
  onTranscript,
  onFinalTranscript,
  onError,
}: UseElevenLabsVoiceOptions) {
  const [phase, setPhaseState] = useState<VoicePhase>("idle");
  const [prospectSpeechEnabled, setProspectSpeechEnabled] = useState(false);
  const phaseRef = useRef<VoicePhase>("idle");
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const transcriptRef = useRef("");
  const submittedRef = useRef(false);
  const intentionalStopRef = useRef(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onTranscript, onFinalTranscript, onError });

  useEffect(() => {
    callbacksRef.current = { onTranscript, onFinalTranscript, onError };
  }, [onError, onFinalTranscript, onTranscript]);

  const setPhase = useCallback((next: VoicePhase) => {
    phaseRef.current = next;
    setPhaseState(next);
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const releaseAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.src = "";
      audioRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }, []);

  const releaseCapture = useCallback(
    (closeConnection: boolean) => {
      clearCloseTimer();
      const connection = connectionRef.current;
      connectionRef.current = null;
      if (closeConnection) connection?.close();
    },
    [clearCloseTimer],
  );

  const failVoice = useCallback(
    (message: string) => {
      intentionalStopRef.current = false;
      releaseCapture(true);
      setPhase("idle");
      callbacksRef.current.onError(message);
    },
    [releaseCapture, setPhase],
  );

  const submitTranscript = useCallback(
    (raw: string) => {
      if (submittedRef.current) return;
      const transcript = raw.trim();
      if (!transcript) {
        releaseCapture(true);
        setPhase("idle");
        return;
      }

      submittedRef.current = true;
      callbacksRef.current.onTranscript(transcript);
      releaseCapture(true);
      setPhase("processing");
      callbacksRef.current.onFinalTranscript(transcript);
    },
    [releaseCapture, setPhase],
  );

  const startListening = useCallback(async () => {
    if (
      !microphoneEnabled ||
      phaseRef.current === "connecting" ||
      phaseRef.current === "listening"
    ) {
      return;
    }

    releaseAudio();
    setProspectSpeechEnabled(true);
    setPhase("connecting");
    transcriptRef.current = "";
    submittedRef.current = false;
    intentionalStopRef.current = false;
    callbacksRef.current.onTranscript("");

    if (!navigator.mediaDevices?.getUserMedia) {
      failVoice("This browser cannot stream microphone audio. Use Chrome or Firefox.");
      return;
    }

    try {
      const response = await fetch(`/api/calls/${callId}/voice/token`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Voice connection is unavailable.");
      const grant = (await response.json()) as Partial<ElevenLabsGrant>;
      if (!grant.token || !grant.baseUri || !grant.modelId) {
        throw new Error("Voice connection returned an invalid token.");
      }

      const connection = Scribe.connect({
        token: grant.token,
        baseUri: grant.baseUri,
        modelId: grant.modelId,
        commitStrategy: CommitStrategy.VAD,
        microphone: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      connectionRef.current = connection;

      connection.on(RealtimeEvents.SESSION_STARTED, () => {
        if (connectionRef.current === connection) setPhase("listening");
      });
      connection.on(RealtimeEvents.PARTIAL_TRANSCRIPT, ({ text }) => {
        if (!text) return;
        transcriptRef.current = text;
        callbacksRef.current.onTranscript(text);
      });
      connection.on(RealtimeEvents.COMMITTED_TRANSCRIPT, ({ text }) => {
        if (text) {
          transcriptRef.current = text;
          callbacksRef.current.onTranscript(text);
        }
        submitTranscript(text || transcriptRef.current);
      });
      connection.on(RealtimeEvents.ERROR, () => {
        failVoice("The ElevenLabs speech connection failed.");
      });
      connection.on(RealtimeEvents.CLOSE, () => {
        if (connectionRef.current === connection) connectionRef.current = null;
        if (submittedRef.current) return;
        if (intentionalStopRef.current && transcriptRef.current) {
          submitTranscript(transcriptRef.current);
          return;
        }
        releaseCapture(false);
        setPhase("idle");
      });
    } catch (error) {
      failVoice(error instanceof Error ? error.message : "Voice connection failed.");
    }
  }, [callId, microphoneEnabled, failVoice, releaseAudio, releaseCapture, setPhase, submitTranscript]);

  const stopListening = useCallback(() => {
    if (phaseRef.current !== "listening") return;
    intentionalStopRef.current = true;
    setPhase("processing");

    const connection = connectionRef.current;
    if (!connection) {
      if (transcriptRef.current) submitTranscript(transcriptRef.current);
      else setPhase("idle");
      return;
    }

    try {
      connection.mute();
      connection.commit();
      closeTimerRef.current = setTimeout(() => {
        if (transcriptRef.current) submitTranscript(transcriptRef.current);
        else {
          releaseCapture(true);
          setPhase("idle");
        }
      }, 4_000);
    } catch {
      if (transcriptRef.current) submitTranscript(transcriptRef.current);
      else {
        releaseCapture(true);
        setPhase("idle");
      }
    }
  }, [releaseCapture, setPhase, submitTranscript]);

  const speak = useCallback(
    async (text: string) => {
      if (!speechEnabled || !prospectSpeechEnabled || !text.trim()) return;
      releaseAudio();
      setPhase("speaking");
      try {
        const response = await fetch(`/api/calls/${callId}/voice/speak`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (!response.ok) throw new Error("Prospect audio is unavailable.");

        const url = URL.createObjectURL(await response.blob());
        audioUrlRef.current = url;
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => {
          releaseAudio();
          setPhase("idle");
        };
        audio.onerror = () => {
          releaseAudio();
          setPhase("idle");
          callbacksRef.current.onError("Prospect audio could not play.");
        };
        await audio.play();
      } catch (error) {
        releaseAudio();
        setPhase("idle");
        callbacksRef.current.onError(
          error instanceof Error ? error.message : "Prospect audio failed.",
        );
      }
    },
    [callId, prospectSpeechEnabled, releaseAudio, setPhase, speechEnabled],
  );

  const markTurnReady = useCallback(() => {
    if (phaseRef.current === "processing") setPhase("idle");
  }, [setPhase]);

  useEffect(
    () => () => {
      releaseCapture(true);
      releaseAudio();
    },
    [releaseAudio, releaseCapture],
  );

  return {
    phase,
    prospectSpeechEnabled,
    isListening: phase === "listening",
    startListening,
    stopListening,
    speak,
    toggleProspectSpeech: () => setProspectSpeechEnabled((enabled) => !enabled),
    markTurnReady,
  };
}
