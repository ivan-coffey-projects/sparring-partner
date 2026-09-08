"use client";

import { useState, useTransition } from "react";
import { saveDrillAction, type DrillPayload } from "@/app/coach/actions";
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
import { cn } from "@/lib/utils";
import { CHANNELS, type Channel } from "@/engine/types";
import { channelLabel } from "@/lib/labels";

export interface DrillFormOptions {
  prospects: Array<{ id: string; name: string; company: string }>;
  scorecards: Array<{ id: string; name: string }>;
  reps: Array<{ id: string; name: string }>;
}

export function DrillForm({
  initial,
  options,
}: {
  initial: DrillPayload;
  options: DrillFormOptions;
}) {
  const [draft, setDraft] = useState<DrillPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveDrillAction(draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Title
          </Label>
          <Input
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            placeholder="Cold discovery: the guarded VP"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Prospect
          </Label>
          <Select
            value={draft.prospectId || undefined}
            onValueChange={(value) =>
              setDraft((d) => ({ ...d, prospectId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a prospect" />
            </SelectTrigger>
            <SelectContent>
              {options.prospects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name} ({p.company})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Channel
          </Label>
          <Select
            value={draft.channel}
            onValueChange={(value) =>
              setDraft((d) => ({ ...d, channel: value as Channel }))
            }
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
          <p className="mt-1 text-[11px] text-muted-foreground">
            Async channels train message craft, cadence, and silence. A
            prospect with an empty opening line means the rep writes first.
          </p>
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Scorecard
          </Label>
          <Select
            value={draft.scorecardId || undefined}
            onValueChange={(value) =>
              setDraft((d) => ({ ...d, scorecardId: value }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Pick a scorecard" />
            </SelectTrigger>
            <SelectContent>
              {options.scorecards.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Briefing shown to the rep
          </Label>
          <Textarea
            rows={3}
            value={draft.briefing}
            onChange={(e) =>
              setDraft((d) => ({ ...d, briefing: e.target.value }))
            }
          />
        </div>
      </section>

      <section className="rounded-xl border bg-card p-5">
        <Label className="block text-xs text-muted-foreground">
          Assigned reps
        </Label>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {options.reps.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No reps yet — invite some from the dashboard.
            </p>
          ) : (
            options.reps.map((rep) => {
              const selected = draft.repIds.includes(rep.id);
              return (
                <button
                  key={rep.id}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      repIds: selected
                        ? d.repIds.filter((id) => id !== rep.id)
                        : [...d.repIds, rep.id],
                    }))
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40",
                  )}
                >
                  {rep.name}
                </button>
              );
            })
          )}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end pb-10">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save drill"}
        </Button>
      </div>
    </div>
  );
}
