"use client";

import { useState, useTransition } from "react";
import { createReviewAction, type ReviewPayload } from "@/app/review/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CHANNELS, type Channel } from "@/engine/types";
import { channelLabel } from "@/lib/labels";

export interface ScorecardOption {
  id: string;
  name: string;
  methodologyName: string;
}

const PLACEHOLDER = `Rep: Hey Dana — Jamie from Atlas Freight. Heard dispatch is re-planning at 5am. Worth a quick look?
Them: Who is this?
Rep: We met at the Fleet Ops meetup last month. You mentioned the routing headaches.
[2 days later]
Rep: Just circling back on this!
`;

export function ReviewForm({ scorecards }: { scorecards: ScorecardOption[] }) {
  const [channel, setChannel] = useState<Channel>("call");
  const [stage, setStage] = useState<"cold" | "active">("cold");
  const [scorecardId, setScorecardId] = useState(scorecards[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    const payload: ReviewPayload = {
      channel,
      stage,
      scorecardId,
      title,
      rawText,
    };
    startTransition(async () => {
      const result = await createReviewAction(payload);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <Select
            value={channel}
            onValueChange={(v) => setChannel(v as Channel)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((c) => (
                <SelectItem key={c} value={c}>
                  {channelLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Deal stage</Label>
          <Select
            value={stage}
            onValueChange={(v) => setStage(v as "cold" | "active")}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cold">Cold outreach</SelectItem>
              <SelectItem value="active">Active deal</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">
            The right ask flips between stages — the grader needs to know.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label>Grade against</Label>
          <Select value={scorecardId} onValueChange={setScorecardId}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a scorecard" />
            </SelectTrigger>
            <SelectContent>
              {scorecards.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Follow-up thread with Corvid Freight"
          maxLength={120}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-text">The conversation</Label>
        <Textarea
          id="review-text"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder={PLACEHOLDER}
          className="min-h-[280px] font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Prefix each message with who sent it — <code>Rep:</code> or{" "}
          <code>Me:</code> for your side, anything else (
          <code>Them:</code>, a name) for the prospect. Square-bracket lines
          like <code>[2 days later]</code> become timeline notes. Email
          threads: keep the <code>Subject:</code> line inside your message.
        </p>
      </div>

      {error ? (
        <p className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-sm text-red-400">
          {error}
        </p>
      ) : null}

      <Button onClick={submit} disabled={pending || rawText.trim().length === 0}>
        {pending ? "Submitting…" : "Score it"}
      </Button>
    </div>
  );
}
