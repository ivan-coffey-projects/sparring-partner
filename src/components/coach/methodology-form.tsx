"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  saveMethodologyAction,
  type MethodologyPayload,
} from "@/app/coach/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type EntryDraft = MethodologyPayload["entries"][number];

export function MethodologyForm({ initial }: { initial: MethodologyPayload }) {
  const [draft, setDraft] = useState<MethodologyPayload>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patchEntry(index: number, update: Partial<EntryDraft>) {
    setDraft((d) => ({
      ...d,
      entries: d.entries.map((entry, i) =>
        i === index ? { ...entry, ...update } : entry,
      ),
    }));
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const result = await saveMethodologyAction(draft);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border bg-card p-5">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Name
          </Label>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            placeholder="Reflective Discovery"
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">
            Description
          </Label>
          <Textarea
            rows={2}
            value={draft.description}
            onChange={(e) =>
              setDraft((d) => ({ ...d, description: e.target.value }))
            }
          />
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Numbered entries
            </h2>
            <p className="text-xs text-muted-foreground">
              The grader may only coach from these. If it can&apos;t cite a
              number below, the point is dropped.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setDraft((d) => ({
                ...d,
                entries: [
                  ...d.entries,
                  { id: null, number: "", title: "", text: "" },
                ],
              }))
            }
          >
            <Plus data-slot="icon" /> Add entry
          </Button>
        </div>
        <div className="mt-4 space-y-3">
          {draft.entries.map((entry, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex gap-3">
                <div className="w-20 shrink-0">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Number
                  </Label>
                  <Input
                    value={entry.number}
                    onChange={(e) => patchEntry(i, { number: e.target.value })}
                    placeholder="3.1"
                    className="font-mono"
                  />
                </div>
                <div className="flex-1">
                  <Label className="mb-1.5 block text-xs text-muted-foreground">
                    Title
                  </Label>
                  <Input
                    value={entry.title}
                    onChange={(e) => patchEntry(i, { title: e.target.value })}
                    placeholder="No pitch before pain"
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="mt-6 shrink-0 text-destructive"
                  disabled={draft.entries.length <= 1}
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      entries: d.entries.filter((_, j) => j !== i),
                    }))
                  }
                >
                  <Trash2 data-slot="icon" />
                </Button>
              </div>
              <div className="mt-3">
                <Label className="mb-1.5 block text-xs text-muted-foreground">
                  Text
                </Label>
                <Textarea
                  rows={2}
                  value={entry.text}
                  onChange={(e) => patchEntry(i, { text: e.target.value })}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex justify-end pb-10">
        <Button onClick={submit} disabled={pending}>
          {pending ? "Saving…" : "Save methodology"}
        </Button>
      </div>
    </div>
  );
}
