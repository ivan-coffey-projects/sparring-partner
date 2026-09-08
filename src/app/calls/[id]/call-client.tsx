"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { toast } from "sonner";
import { LockOpen, Mic, PhoneOff, Square, Volume2 } from "lucide-react";
import { endCallAction } from "@/app/calls/actions";
import { PatienceMeter } from "@/components/call/patience-meter";
import { useElevenLabsVoice } from "@/components/call/use-elevenlabs-voice";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { outcomeLabel } from "@/lib/labels";
import type { CallOutcome } from "@/engine/types";
import { uiMessageText, type SparringUIMessage } from "@/lib/chat-message";

interface InitialTurn {
  id: string;
  speaker: "rep" | "prospect";
  text: string;
}

interface CallClientProps {
  callId: string;
  prospect: { name: string; jobTitle: string; company: string };
  briefing: string;
  initialPatience: number;
  initialUnlockedCount: number;
  factsTotal: number;
  initialTurns: InitialTurn[];
  microphoneAvailable: boolean;
  prospectSpeechAvailable: boolean;
}

export function CallClient({
  callId,
  prospect,
  briefing,
  initialPatience,
  initialUnlockedCount,
  factsTotal,
  initialTurns,
  microphoneAvailable,
  prospectSpeechAvailable,
}: CallClientProps) {
  const [patience, setPatience] = useState(initialPatience);
  const [unlockedCount, setUnlockedCount] = useState(initialUnlockedCount);
  const [ended, setEnded] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastSpokenMessageIdRef = useRef(
    initialTurns.findLast((turn) => turn.speaker === "prospect")?.id,
  );
  const regenerateRef = useRef<(() => Promise<void>) | null>(null);

  const initialMessages = useMemo<SparringUIMessage[]>(
    () =>
      initialTurns.map((turn) => ({
        id: turn.id,
        role: turn.speaker === "rep" ? ("user" as const) : ("assistant" as const),
        parts: [{ type: "text" as const, text: turn.text }],
      })),
    [initialTurns],
  );

  const { messages, sendMessage, status, regenerate } = useChat<SparringUIMessage>({
    id: callId,
    messages: initialMessages,
    transport: new DefaultChatTransport({ api: `/api/calls/${callId}/turn` }),
    onError: (error) => {
      // The turn pipeline commits atomically, so a failed turn wrote nothing:
      // the call is still exactly as the rep left it and the same message can
      // be sent again. `regenerate` re-requests from the trailing rep line
      // without adding a second copy of it to the transcript.
      toast.error(error.message, {
        action: { label: "Try again", onClick: () => void regenerateRef.current?.() },
        duration: 10000,
      });
    },
    onData: (dataPart) => {
      if (dataPart.type === "data-turn-meta") {
        setPatience(dataPart.data.patience);
        setUnlockedCount(dataPart.data.factsUnlockedCount);
        for (const fact of dataPart.data.unlocked) {
          toast(`The hidden file opens: ${fact.label}`, {
            icon: <LockOpen className="size-4" />,
            duration: 5000,
          });
        }
      }
      if (dataPart.type === "data-call-status" && dataPart.data.status === "ended") {
        setEnded(true);
        setOutcome(dataPart.data.outcome);
      }
    },
  });

  useEffect(() => {
    regenerateRef.current = () => regenerate();
  }, [regenerate]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const busy = status === "submitted" || status === "streaming";
  const canSend = !ended && !busy && input.trim().length > 0;
  const voice = useElevenLabsVoice({
    callId,
    microphoneEnabled: microphoneAvailable,
    speechEnabled: prospectSpeechAvailable,
    onTranscript: setInput,
    onFinalTranscript: (transcript) => {
      if (ended || busy || !transcript.trim()) return;
      void sendMessage({ text: transcript.trim() });
      setInput("");
    },
    onError: (message) => toast.error(message),
  });

  useEffect(() => {
    if (status === "ready") voice.markTurnReady();
  }, [status, voice]);

  useEffect(() => {
    if (
      !prospectSpeechAvailable ||
      !voice.prospectSpeechEnabled ||
      status !== "ready"
    ) {
      return;
    }
    const lastMessage = messages.at(-1);
    if (
      !lastMessage ||
      lastMessage.role !== "assistant" ||
      lastSpokenMessageIdRef.current === lastMessage.id
    ) {
      return;
    }
    const text = uiMessageText(lastMessage).trim();
    if (!text) return;
    lastSpokenMessageIdRef.current = lastMessage.id;
    void voice.speak(text);
  }, [messages, prospectSpeechAvailable, status, voice]);

  function handleSend() {
    if (!canSend) return;
    void sendMessage({ text: input.trim() });
    setInput("");
  }

  return (
    <div className="flex h-dvh flex-col bg-stage md:items-center md:justify-center md:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground md:h-[min(844px,calc(100dvh-48px))] md:w-[min(420px,100%)] md:rounded-[28px] md:border md:border-foreground/30">
      <header className="rounded-t-[22px] bg-background text-foreground md:rounded-t-[27px]">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground font-semibold text-background">
              {prospect.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">
                {prospect.name}
              </p>
              <p className="truncate text-xs text-foreground/60">
                {prospect.jobTitle}, {prospect.company}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right label-micro text-foreground/60 sm:block">
              <p>Hidden file</p>
              <p className="font-mono text-sm font-normal normal-case tracking-tight text-foreground">
                {unlockedCount}/{factsTotal}{" "}
                <span className="text-foreground/55">opened</span>
              </p>
            </div>
            <PatienceMeter value={patience} />
            <form action={endCallAction.bind(null, callId)}>
              <Button
                type="submit"
                variant="destructive"
                size="sm"
                disabled={busy}
              >
                <PhoneOff data-slot="icon" />
                End
              </Button>
            </form>
          </div>
        </div>
      </header>

      {/* ── Transcript ──────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-card">
        <div className="flex flex-col gap-4 px-4 py-5">
          <p className="rounded-[18px] bg-background px-4 py-3 text-xs leading-relaxed text-foreground/70">
            {briefing}
          </p>
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              prospectName={prospect.name}
            />
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <Dot delay="0ms" />
                <Dot delay="150ms" />
                <Dot delay="300ms" />
              </span>
              {prospect.name.split(" ")[0]} is{" "}
              {status === "submitted" ? "thinking" : "talking"}…
            </div>
          ) : null}
          {ended ? (
            <div
              className={cn(
                "mt-2 rounded-xl border p-5 text-center",
                outcome === "meeting_booked"
                  ? "border-emerald-500/40 bg-emerald-500/10"
                  : "border-red-500/30 bg-red-500/5",
              )}
            >
              <p className="text-lg font-semibold">
                {outcome === "meeting_booked"
                  ? "Meeting booked."
                  : outcome === "hung_up"
                    ? `${prospect.name.split(" ")[0]} hung up.`
                    : outcomeLabel(outcome)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The call is over. Your graded debrief is on its way.
              </p>
              <Button asChild className="mt-4">
                <Link href={`/calls/${callId}/debrief`}>See your debrief</Link>
              </Button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Composer ────────────────────────────────────────────────── */}
      <div className="border-t border-border bg-card">
        <div className="px-4 py-3">
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={
                ended ? "The call has ended." : `Talk to ${prospect.name.split(" ")[0]}…`
              }
              disabled={ended || busy || voice.isListening}
              rows={2}
              className="min-h-0 resize-none"
            />
            {microphoneAvailable ? (
              <Button
                type="button"
                variant={voice.isListening ? "destructive" : "outline"}
                size="icon"
                onClick={
                  voice.isListening ? voice.stopListening : voice.startListening
                }
                disabled={
                  ended ||
                  busy ||
                  voice.phase === "connecting" ||
                  voice.phase === "processing"
                }
                aria-label={voice.isListening ? "Stop speaking" : "Speak"}
                title={voice.isListening ? "Stop speaking" : "Speak with ElevenLabs"}
                className="shrink-0"
              >
                {voice.isListening ? <Square /> : <Mic />}
              </Button>
            ) : null}
            {prospectSpeechAvailable ? (
              <Button
                type="button"
                variant={voice.prospectSpeechEnabled ? "secondary" : "outline"}
                size="icon"
                onClick={voice.toggleProspectSpeech}
                disabled={ended}
                aria-label={
                  voice.prospectSpeechEnabled
                    ? "Turn prospect voice off"
                    : "Turn prospect voice on"
                }
                title={
                  voice.prospectSpeechEnabled
                    ? "Turn prospect voice off"
                    : "Turn prospect voice on"
                }
                className="shrink-0"
              >
                <Volume2 />
              </Button>
            ) : null}
            <Button onClick={handleSend} disabled={!canSend} className="shrink-0">
              Send
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {microphoneAvailable || prospectSpeechAvailable
              ? voiceStatus(
                  voice.phase,
                  microphoneAvailable,
                  prospectSpeechAvailable,
                  voice.prospectSpeechEnabled,
                )
              : "Enter to send · Shift+Enter for a new line"}
          </p>
        </div>
      </div>
      </div>
    </div>
  );
}

function voiceStatus(
  phase: ReturnType<typeof useElevenLabsVoice>["phase"],
  microphoneAvailable: boolean,
  prospectSpeechAvailable: boolean,
  prospectSpeechEnabled: boolean,
): string {
  switch (phase) {
    case "connecting":
      return "Connecting microphone…";
    case "listening":
      return "Listening · pause naturally or press stop";
    case "processing":
      return "Sending transcript through the sparring engine…";
    case "speaking":
      return "Prospect is speaking · press the mic to interrupt";
    default:
      if (prospectSpeechAvailable && prospectSpeechEnabled) {
        return microphoneAvailable
          ? "Prospect voice on · mic uses ElevenLabs"
          : "Prospect voice on · text drives the sparring engine";
      }
      return microphoneAvailable
        ? "Mic uses ElevenLabs · text still drives the sparring engine"
        : "Turn on prospect voice to hear their replies";
  }
}

function MessageBubble({
  message,
  prospectName,
}: {
  message: SparringUIMessage;
  prospectName: string;
}) {
  const text = message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
  const unlocks = message.parts.flatMap((part) =>
    part.type === "data-turn-meta" ? part.data.unlocked : [],
  );
  const rejectedConcessions = message.parts.filter(
    (part) => part.type === "data-concession" && !part.data.approved,
  ).length;
  const isRep = message.role === "user";
  if (!text && unlocks.length === 0) return null;
  return (
    <div className={cn("flex flex-col gap-1.5", isRep ? "items-end" : "items-start")}>
      {unlocks.map((fact) => (
        <span
          key={fact.id}
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-400"
        >
          <LockOpen className="size-3" />
          Hidden file opened: {fact.label}
        </span>
      ))}
      {rejectedConcessions > 0 ? (
        <span className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-3 py-1 text-xs text-amber-400">
          Asked for a commitment you haven&apos;t earned yet
        </span>
      ) : null}
      {text ? (
        <div
          className={cn(
            "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isRep
              ? "rounded-br-md bg-background text-foreground"
              : "rounded-bl-md bg-muted text-card-foreground",
          )}
        >
          {!isRep ? (
            <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
              {prospectName}
            </p>
          ) : null}
          {text}
        </div>
      ) : null}
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
      style={{ animationDelay: delay }}
    />
  );
}
