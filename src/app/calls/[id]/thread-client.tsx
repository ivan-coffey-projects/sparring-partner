"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Clock, LockOpen, LogOut } from "lucide-react";
import { endCallAction } from "@/app/calls/actions";
import { PatienceMeter } from "@/components/call/patience-meter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { channelLabel, outcomeLabel } from "@/lib/labels";
import { durationLabel } from "@/lib/duration";
import type { AsyncChannel, CallOutcome } from "@/engine/types";
import type { TurnMeta } from "@/db/schema";

interface ThreadTurn {
  id: string;
  speaker: "rep" | "prospect" | "system";
  text: string;
  meta: TurnMeta | null;
}

interface ThreadClientProps {
  callId: string;
  channel: AsyncChannel;
  prospect: { name: string; jobTitle: string; company: string };
  briefing: string;
  initialEngagement: number;
  initialUnlockedCount: number;
  factsTotal: number;
  initialTurns: ThreadTurn[];
  initialSimClockMinutes: number;
}

interface MessageResponse {
  newTurns: ThreadTurn[];
  engagement: number;
  newlyUnlockedFacts: Array<{ id: string; label: string }>;
  factsUnlockedCount: number;
  concessionEvents: Array<{
    request: { type: string };
    verdict: { approved: boolean };
  }>;
  replied: boolean;
  delayMinutes: number;
  simClockMinutes: number;
  callStatus: "live" | "ended";
  outcome: CallOutcome | null;
  error?: string;
}

const WAIT_CHOICES: Array<{ minutes: number; label: string }> = [
  { minutes: 4 * 60, label: "Wait 4 hours" },
  { minutes: 24 * 60, label: "Wait a day" },
  { minutes: 3 * 24 * 60, label: "Wait 3 days" },
];

/** Phone-shaped channels get the phone frame; email/LinkedIn get a desk view. */
function isPhoneStyle(channel: AsyncChannel): boolean {
  return channel === "sms" || channel === "dm_instagram";
}

export function ThreadClient({
  callId,
  channel,
  prospect,
  briefing,
  initialEngagement,
  initialUnlockedCount,
  factsTotal,
  initialTurns,
  initialSimClockMinutes,
}: ThreadClientProps) {
  const [turns, setTurns] = useState<ThreadTurn[]>(initialTurns);
  const [engagement, setEngagement] = useState(initialEngagement);
  const [unlockedCount, setUnlockedCount] = useState(initialUnlockedCount);
  const [simClock, setSimClock] = useState(initialSimClockMinutes);
  const [ended, setEnded] = useState(false);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [awaitingReply, setAwaitingReply] = useState(false);
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [turns, busy]);

  const hasRepMessage = turns.some((t) => t.speaker === "rep");
  const needsSubject = channel === "email" && !hasRepMessage;
  const canSend =
    !ended &&
    !busy &&
    input.trim().length > 0 &&
    (!needsSubject || subject.trim().length > 0);

  async function send() {
    if (!canSend) return;
    const text = input.trim();
    const sentSubject = needsSubject ? subject.trim() : undefined;
    const optimisticId = `local-${turns.length}`;
    setBusy(true);
    setInput("");
    setTurns((prev) => [
      ...prev,
      {
        id: optimisticId,
        speaker: "rep",
        text,
        meta: sentSubject ? { subject: sentSubject } : null,
      },
    ]);
    // The server writes the whole turn in one transaction, so a failure means
    // nothing was persisted. Drop the optimistic line and hand the message
    // back to the rep rather than leaving the thread showing a message the
    // database never received.
    const rollback = () => {
      setTurns((prev) => prev.filter((turn) => turn.id !== optimisticId));
      setInput(text);
      if (sentSubject) setSubject(sentSubject);
    };
    try {
      const res = await fetch(`/api/calls/${callId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, subject: sentSubject }),
      });
      const data = (await res.json()) as MessageResponse;
      if (!res.ok) {
        rollback();
        toast.error(data.error ?? "The thread hit a snag.");
        return;
      }
      setEngagement(data.engagement);
      setUnlockedCount(data.factsUnlockedCount);
      setSimClock(data.simClockMinutes);
      setAwaitingReply(!data.replied && data.callStatus === "live");
      for (const fact of data.newlyUnlockedFacts) {
        toast(`They opened up: ${fact.label}`, {
          icon: <LockOpen className="size-4" />,
        });
      }
      if (data.concessionEvents.some((e) => !e.verdict.approved)) {
        toast.warning("You asked for a commitment you haven't earned yet.");
      }
      setTurns((prev) => [...prev, ...data.newTurns]);
      if (data.callStatus === "ended") {
        setEnded(true);
        setOutcome(data.outcome);
      }
    } catch {
      rollback();
      toast.error("The thread hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  async function wait(minutes: number) {
    if (ended || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/calls/${callId}/wait`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ minutes }),
      });
      const data = (await res.json()) as {
        turn?: ThreadTurn;
        simClockMinutes?: number;
        error?: string;
      };
      if (!res.ok || !data.turn) {
        toast.error(data.error ?? "The thread hit a snag.");
        return;
      }
      setTurns((prev) => [...prev, data.turn!]);
      if (data.simClockMinutes !== undefined) setSimClock(data.simClockMinutes);
    } catch {
      toast.error("The thread hit a snag.");
    } finally {
      setBusy(false);
    }
  }

  const phone = isPhoneStyle(channel);
  const firstName = prospect.name.split(" ")[0];

  const thread = (
    <>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className={cn("bg-background text-foreground", phone ? "rounded-t-[22px] md:rounded-t-[27px]" : "rounded-t-[22px]")}>
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground font-semibold text-background">
              {prospect.name
                .split(" ")
                .map((w) => w[0])
                .slice(0, 2)
                .join("")}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium leading-tight">{prospect.name}</p>
              <p className="truncate text-xs text-foreground/60">
                {channelLabel(channel)} · {prospect.jobTitle}, {prospect.company}
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
            <PatienceMeter value={engagement} label="Interest" />
            <form action={endCallAction.bind(null, callId)}>
              <Button type="submit" variant="destructive" size="sm" disabled={busy}>
                <LogOut data-slot="icon" />
                Walk away
              </Button>
            </form>
          </div>
        </div>
        <p className="border-t border-foreground/10 px-4 py-1.5 text-center font-mono text-[10px] uppercase tracking-wide text-foreground/50">
          Simulated time: {simClock === 0 ? "thread opened" : `${durationLabel(simClock)} in`}
        </p>
      </header>

      {/* ── Thread ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto bg-card">
        <div className="flex flex-col gap-4 px-4 py-5">
          <p className="rounded-[18px] bg-background px-4 py-3 text-xs leading-relaxed text-foreground/70">
            {briefing}
          </p>
          {turns.map((turn) =>
            turn.speaker === "system" ? (
              <p
                key={turn.id}
                className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground"
              >
                {turn.text}
              </p>
            ) : (
              <div key={turn.id} className="flex flex-col gap-1">
                {turn.meta?.delayMinutes ? (
                  <p className="text-center font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                    {durationLabel(turn.meta.delayMinutes)} later
                  </p>
                ) : null}
                {channel === "email" ? (
                  <div
                    className={cn(
                      "rounded-xl border p-4",
                      turn.speaker === "rep" ? "bg-background" : "bg-muted/30",
                    )}
                  >
                    <p className="text-[11px] font-medium text-muted-foreground">
                      {turn.speaker === "rep" ? "You" : prospect.name}
                      {turn.meta?.subject ? (
                        <span className="ml-2 text-foreground">
                          Subject: {turn.meta.subject}
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">
                      {turn.text}
                    </p>
                  </div>
                ) : (
                  <div
                    className={cn(
                      "flex",
                      turn.speaker === "rep" ? "justify-end" : "justify-start",
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                        turn.speaker === "rep"
                          ? "rounded-br-md bg-background text-foreground"
                          : "rounded-bl-md bg-muted text-card-foreground",
                      )}
                    >
                      {turn.speaker === "prospect" ? (
                        <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
                          {prospect.name}
                        </p>
                      ) : null}
                      {turn.text}
                    </div>
                  </div>
                )}
              </div>
            ),
          )}
          {busy ? (
            <p className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              …
            </p>
          ) : awaitingReply && !ended ? (
            <p className="text-center font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
              Delivered · no reply yet. Wait it out, or make the next message
              count.
            </p>
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
                  : outcome === "ghosted"
                    ? `${firstName} went dark.`
                    : outcome === "opted_out"
                      ? `${firstName} opted out.`
                      : outcomeLabel(outcome)}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                The thread is over. Your graded debrief is on its way.
              </p>
              <Button asChild className="mt-4">
                <Link href={`/calls/${callId}/debrief`}>See your debrief</Link>
              </Button>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* ── Composer ───────────────────────────────────────────────── */}
      <div className="border-t border-border bg-card">
        <div className="space-y-2 px-4 py-3">
          {needsSubject ? (
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject"
              disabled={ended || busy}
            />
          ) : null}
          <div className="flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && channel !== "email") {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder={
                ended
                  ? "The thread has ended."
                  : channel === "email"
                    ? `Write your email to ${firstName}…`
                    : `Message ${firstName}…`
              }
              disabled={ended || busy}
              rows={channel === "email" ? 5 : 2}
              className="min-h-0 resize-none"
            />
            <Button onClick={() => void send()} disabled={!canSend} className="shrink-0">
              Send
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {WAIT_CHOICES.map((choice) => (
              <Button
                key={choice.minutes}
                variant="ghost"
                size="sm"
                disabled={ended || busy}
                onClick={() => void wait(choice.minutes)}
                className="text-xs text-muted-foreground"
              >
                <Clock data-slot="icon" />
                {choice.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </>
  );

  if (phone) {
    return (
      <div className="flex h-dvh flex-col bg-stage md:items-center md:justify-center md:p-6">
        <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground md:h-[min(844px,calc(100dvh-48px))] md:w-[min(420px,100%)] md:rounded-[28px] md:border md:border-foreground/30">
          {thread}
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-dvh flex-col bg-stage md:items-center md:justify-center md:p-6">
      <div className="flex h-full w-full flex-col overflow-hidden bg-card text-card-foreground md:h-[min(844px,calc(100dvh-48px))] md:w-[min(720px,100%)] md:rounded-[22px] md:border md:border-foreground/30">
        {thread}
      </div>
    </div>
  );
}
